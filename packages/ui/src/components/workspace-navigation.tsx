"use client";

import {
  House,
  Link2,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Button } from "./button";

export function WorkspaceNavigation({
  current,
  shopName,
  labels,
}: {
  current: "owner" | "connections" | "customers" | "settings";
  shopName: string;
  labels: {
    navigation: string;
    workspace: string;
    homeShort?: string;
    connectionsShort?: string;
    settingsShort?: string;
    connections: string;
    customers?: string;
    settings?: string;
    currentShop: string;
    expandNavigation: string;
    collapseNavigation: string;
  };
}) {
  const [collapsed, setCollapsed] = useState(true);
  return (
    <nav
      className="workspace-navigation"
      aria-label={labels.navigation}
      data-collapsed={collapsed}
    >
      <Button
        className="workspace-rail-toggle hidden md:inline-flex xl:hidden"
        variant="ghost"
        size="icon"
        aria-label={
          collapsed ? labels.expandNavigation : labels.collapseNavigation
        }
        aria-expanded={!collapsed}
        aria-controls="workspace-destinations"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <PanelLeftOpen aria-hidden="true" />
        ) : (
          <PanelLeftClose aria-hidden="true" />
        )}
      </Button>
      <p className="workspace-current-shop">
        <span className="text-muted-foreground">{labels.currentShop}</span>
        <strong>{shopName}</strong>
      </p>
      <ul id="workspace-destinations">
        {[
          {
            href: "/dashboard",
            label: labels.workspace,
            short: labels.homeShort,
            Icon: House,
            id: "owner",
          },
          {
            href: "/customers",
            label: labels.customers,
            Icon: Users,
            id: "customers",
          },
          {
            href: "/connections",
            label: labels.connections,
            short: labels.connectionsShort,
            Icon: Link2,
            id: "connections",
          },
          {
            href: "/settings",
            label: labels.settings,
            short: labels.settingsShort,
            Icon: Settings,
            id: "settings",
          },
        ]
          .filter(({ label }) => !!label)
          .map(({ href, label, short, Icon, id }) => (
            <li key={id}>
              <a
                href={href}
                aria-current={current === id ? "page" : undefined}
                aria-label={
                  short &&
                  !label
                    ?.toLocaleLowerCase()
                    .includes(short.toLocaleLowerCase())
                    ? `${label} (${short})`
                    : label
                }
              >
                <Icon aria-hidden="true" />
                <span
                  className="workspace-destination-label"
                  data-has-short={!!short}
                >
                  {label}
                </span>
                {short && (
                  <span className="workspace-short-label" aria-hidden="true">
                    {short}
                  </span>
                )}
              </a>
            </li>
          ))}
      </ul>
    </nav>
  );
}
