import {requestMediaUpload,completeMediaUpload,createMediaClient} from "@aarili/api/client";
requestMediaUpload("shop",{subjectId:"id",purpose:"public-gallery",contentType:"image/png",size:1},"key");
requestMediaUpload("shop",{subjectId:"id",purpose:"wearer-photo",contentType:"image/png",size:1,guardianConsent:true},"key");
completeMediaUpload("shop","id","key",7);
createMediaClient().shops[":shopId"].files[":id"].$delete({param:{shopId:"shop",id:"id"}});
createMediaClient().shops[":shopId"].files[":id"].status.$post({param:{shopId:"shop",id:"id"}});
createMediaClient().shops[":shopId"].files[":id"].variants[":variant"].access.$get({param:{shopId:"shop",id:"id",variant:"public"}});
