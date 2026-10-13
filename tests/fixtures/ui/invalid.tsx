import { Button } from "../../../packages/ui/src/components/button";
import { Card } from "../../../packages/ui/src/components/card";
import { Status } from "../../../packages/ui/src/components/status";
import { HealthResult } from "../../../apps/web/src/app/health-status";

Button({ variant: "burgundy" });
Button({ size: "tiny" });
Card({ density: "cramped" });
Status({ tone: "paid" });
HealthResult({ result: { status: "healthy", service: "aarili-web" } });
