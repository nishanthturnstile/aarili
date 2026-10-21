import type {AcceptedServiceOrder,ServiceOrderDraft,ServiceProfileContent} from "@aarili/contracts/small-services";
import {reviewServiceOrder} from "@aarili/api/small-services-client";
const badUnit:ServiceProfileContent["capacityUnit"]="hours";
const badState:AcceptedServiceOrder["lines"][number]["state"]="completed";
const badPriority:ServiceOrderDraft["priority"]="festival";
reviewServiceOrder("shop",{customerId:"person",paid:true});
const badPrice:AcceptedServiceOrder["lines"][number]["pricePaise"]="0";
void badUnit;void badState;void badPriority;void badPrice;
