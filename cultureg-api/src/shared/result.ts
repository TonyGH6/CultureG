/** Unified service result types */

export type ServiceOk<T = {}> = { ok: true } & T;
export type ServiceErr = { ok: false; status: number; error: string };
export type ServiceResult<T = {}> = ServiceOk<T> | ServiceErr;

/** Convenience constructors */
export function ok<T>(data: T): ServiceOk<T> {
    return { ok: true, ...data };
}

export function err(status: number, error: string): ServiceErr {
    return { ok: false, status, error };
}
