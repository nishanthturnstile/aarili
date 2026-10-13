import { entityKind } from "../entity.js";
export interface GelRoleConfig {
    createDb?: boolean | undefined;
    createRole?: boolean | undefined;
    inherit?: boolean | undefined;
}
export declare class GelRole implements GelRoleConfig {
    readonly name: string;
    static readonly [entityKind]: string;
    readonly createDb: boolean | undefined;
    readonly createRole: boolean | undefined;
    readonly inherit: boolean | undefined;
    constructor(name: string, config?: GelRoleConfig);
    existing(): this;
}
export declare function gelRole(name: string, config?: GelRoleConfig): GelRole;
