import {requestDocumentIssue,requestDocumentRetry,requestDocumentStatus,requestDocumentAccess,createDocumentClient} from "@aarili/api/client";
requestDocumentIssue("shop",{docId:"id",revision:1,template:"known",templateRevision:1,language:"fr",model:{}},"key");
requestDocumentIssue("shop",{docId:"id",revision:1,template:"known",templateRevision:1,language:"ta",paper:"Letter",model:{}},"key");
requestDocumentRetry("shop","doc",1,"key","v1");
requestDocumentStatus("shop","doc","1");
requestDocumentAccess("shop","doc",false);
createDocumentClient().shops[":shopId"].documents[":docId"][":revision"].status.$post({param:{shopId:"shop",docId:"doc",revision:"1"}});
