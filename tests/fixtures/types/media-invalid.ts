import {requestMediaUpload,completeMediaUpload,createMediaClient} from "@aarili/api/client";
requestMediaUpload("shop",{subjectId:"id",purpose:"public-gallery",contentType:"image/png",size:1},"key");
requestMediaUpload("shop",{subjectId:"id",purpose:"wearer-photo",contentType:"image/png",size:1,guardianConsent:true},"key");
completeMediaUpload("shop","id","key",7);
createMediaClient().shops[":shopId"].files[":id"].$delete({param:{shopId:"shop",id:"id"}});
