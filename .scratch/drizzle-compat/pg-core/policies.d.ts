import { entityKind } from "../entity.js";
import type { SQL } from "../sql/sql.js";
import type { PgRole } from "./roles.js";
import type { PgTable } from "./table.js";
export type PgPolicyToOption = 'public' | 'current_role' | 'current_user' | 'session_user' | (string & {}) | PgPolicyToOption[] | PgRole;
export interface PgPolicyConfig {
    as?: 'permissive' | 'restrictive' | undefined;
    for?: 'all' | 'select' | 'insert' | 'update' | 'delete' | undefined;
    to?: PgPolicyToOption | undefined;
    using?: SQL | undefined;
    withCheck?: SQL | undefined;
}
export declare class PgPolicy implements PgPolicyConfig {
    readonly name: string;
    static readonly [entityKind]: string;
    readonly as: PgPolicyConfig['as'];
    readonly for: PgPolicyConfig['for'];
    readonly to: PgPolicyConfig['to'];
    readonly using: PgPolicyConfig['using'];
    readonly withCheck: PgPolicyConfig['withCheck'];
    constructor(name: string, config?: PgPolicyConfig);
    link(table: PgTable): this;
}
export declare function pgPolicy(name: string, config?: PgPolicyConfig): PgPolicy;
