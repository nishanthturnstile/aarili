import { entityKind } from "../entity.js";
export interface PgRoleConfig {
    createDb?: boolean | undefined;
    createRole?: boolean | undefined;
    inherit?: boolean | undefined;
}
export declare class PgRole implements PgRoleConfig {
    readonly name: string;
    static readonly [entityKind]: string;
    readonly createDb: boolean | undefined;
    readonly createRole: boolean | undefined;
    readonly inherit: boolean | undefined;
    constructor(name: string, config?: PgRoleConfig);
    existing(): this;
}
export declare function pgRole(name: string, config?: PgRoleConfig): PgRole;
