"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eloDeltaSolo = eloDeltaSolo;
function eloDeltaSolo(score, total) {
    const ratio = total === 0 ? 0 : score / total;
    if (ratio >= 0.9)
        return +12;
    if (ratio >= 0.7)
        return +7;
    if (ratio >= 0.5)
        return +2;
    if (ratio >= 0.3)
        return -3;
    return -8;
}
