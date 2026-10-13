$ErrorActionPreference = 'Stop'
$repoName = 'nishanthturnstile/aarili'
$draftRoot = $PSScriptRoot
$publicationRoot = Join-Path $draftRoot 'published'
[void][System.IO.Directory]::CreateDirectory($publicationRoot)
$utf8 = [System.Text.UTF8Encoding]::new($false)
$draftFiles = @(
    '01-owner-bootstrap.md',
    '02-owner-recovery.md',
    '03-explicit-google-linking.md',
    '04-shop-context-rls.md',
    '05-command-audit-conflicts.md'
)
$priorNumber = 6
$publishedRows = @()

foreach ($draftFile in $draftFiles) {
    $draftPath = Join-Path $draftRoot $draftFile
    $draftText = [System.IO.File]::ReadAllText($draftPath).Replace("`r`n", "`n")
    $titleEnd = $draftText.IndexOf("`n")
    if ($titleEnd -lt 0 -or -not $draftText.StartsWith('# [W0 0.2.')) {
        throw "Unexpected draft heading: $draftFile"
    }
    $issueTitle = $draftText.Substring(2, $titleEnd - 2)
    $bodyText = $draftText.Substring($titleEnd + 1).TrimStart()
    $bodyText = $bodyText.Replace(
        '**Status:** Draft awaiting owner approval. Proposed publication label: `ready-for-agent`.',
        '**Status:** Approved implementation ticket (`ready-for-agent`). Implementation requires a separate user request and merged direct blockers.'
    )

    $priorJson = & gh api "repos/$repoName/issues/$priorNumber"
    if ($LASTEXITCODE -ne 0) { throw "Cannot read blocker #$priorNumber" }
    $priorIssue = ($priorJson -join "`n") | ConvertFrom-Json
    $priorDatabaseId = [long]$priorIssue.id
    if ($draftFile -ne '01-owner-bootstrap.md') {
        $blockerText = "## Blocked by`n`n- [Issue #$priorNumber - $($priorIssue.title)]($($priorIssue.html_url)). Must merge before implementation; approval of this ticket does not override its open dependency.`n`n"
        if ($draftFile -eq '04-shop-context-rls.md') {
            $blockerText += "This preserves the roadmap prerequisite on completed 0.2.1. Extend the protected initial shop/membership from 0.2.1a rather than rebuilding it.`n`n"
        }
        $bodyText = [regex]::Replace(
            $bodyText,
            '(?s)## Blocked by\n.*?(?=## Sources and expected outcome)',
            [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $blockerText }
        )
    }
    if ($bodyText.Contains('Draft awaiting owner approval') -or $bodyText -match 'publication will replace|Use the assigned issue number|Replace with the published issue') {
        throw "Unresolved publication placeholder: $draftFile"
    }
    $bodyPath = Join-Path $publicationRoot $draftFile
    [System.IO.File]::WriteAllText($bodyPath, $bodyText.TrimEnd() + "`n", $utf8)

    # A read before create makes resuming after an uncertain CLI response safe.
    $existingJson = & gh issue list --repo $repoName --state all --limit 100 --json number,title,url
    if ($LASTEXITCODE -ne 0) { throw 'Cannot check existing tickets before create' }
    $existingIssues = ($existingJson -join "`n") | ConvertFrom-Json
    $matches = @($existingIssues | Where-Object { $_.title -eq $issueTitle })
    if ($matches.Count -gt 1) { throw "Duplicate existing title: $issueTitle" }
    if ($matches.Count -eq 1) {
        $issueNumber = [int]$matches[0].number
        $issueUrl = [string]$matches[0].url
        Write-Output "Reusing existing #$issueNumber after publication read-back."
    } else {
        $createOutput = & gh issue create --repo $repoName --title $issueTitle --body-file $bodyPath --label ready-for-agent
        if ($LASTEXITCODE -ne 0) { throw "Issue creation failed or uncertain: $issueTitle. Read tracker before retry." }
        $issueUrl = ($createOutput -join "`n").Trim()
        if ($issueUrl -notmatch '^https://github\.com/nishanthturnstile/aarili/issues/(\d+)$') {
            throw "Unexpected creation response; read tracker before retry: $issueUrl"
        }
        $issueNumber = [int]$Matches[1]
        Write-Output "Created #$issueNumber - $issueTitle"
    }

    $publishedRows += [pscustomobject]@{
        draft = $draftFile
        number = $issueNumber
        title = $issueTitle
        url = $issueUrl
        blockedBy = $priorNumber
        bodyFile = $bodyPath
    }
    [System.IO.File]::WriteAllText(
        (Join-Path $publicationRoot 'issues.json'),
        (ConvertTo-Json -InputObject @($publishedRows) -Depth 6),
        $utf8
    )

    $edgeJson = & gh api "repos/$repoName/issues/$issueNumber/dependencies/blocked_by"
    if ($LASTEXITCODE -ne 0) { throw "Cannot read dependency for #$issueNumber" }
    $edges = ($edgeJson -join "`n") | ConvertFrom-Json
    if (@($edges | Where-Object { [long]$_.id -eq $priorDatabaseId }).Count -eq 0) {
        $edgeOutput = & gh api --method POST "repos/$repoName/issues/$issueNumber/dependencies/blocked_by" -H 'Accept: application/vnd.github+json' -F "issue_id=$priorDatabaseId" --jq '{number, id, state}'
        if ($LASTEXITCODE -ne 0) { throw "Native dependency creation failed for #$issueNumber; explicit body reference remains. Inspect before retry." }
        Write-Output "Native dependency: #$issueNumber blocked by #$priorNumber"
    }
    $priorNumber = $issueNumber
}

Write-Output 'All five issues published. Fresh body/label/dependency verification remains required.'
