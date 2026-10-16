import {createDraftClient,putDraft} from "@aarili/api/client";
import type {DraftSave,DraftRecord} from "@aarili/contracts/drafts";
const bad:DraftSave={workflow:"fixture",schemaVersion:"1",payload:{}};
const lifecycle:DraftRecord["lifecycle"]="confirmed";
createDraftClient().shops[":shopId"].drafts[":id"].$post({param:{shopId:"x",id:"x"}});
putDraft("shop","id",{payload:{}},"key");
createDraftClient().shops[":shopId"].drafts[":id"].promote.$post({param:{shopId:"x",id:"x"},json:{},header:{"if-match":1}});
void bad;void lifecycle;
