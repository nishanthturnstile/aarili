import { Button } from "../../../packages/ui/src/components/button";
import { Card } from "../../../packages/ui/src/components/card";
import { Status } from "../../../packages/ui/src/components/status";
import type { HealthResponse } from "../../../packages/contracts/src/index";

Button({ variant: "burgundy" });
Button({ size: "tiny" });
Card({ density: "cramped" });
Status({ tone: "paid" });
const invalidHealth: HealthResponse = { status: "healthy", service: "aarili-web" };
void invalidHealth;
