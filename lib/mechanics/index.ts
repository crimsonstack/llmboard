import { registerMechanic } from "./registry";
import { builtinMechanics } from "./builtin";

// Call this once on module import to register all built-in mechanics.
for (const mech of builtinMechanics) {
  registerMechanic(mech);
}

export * from "./registry";
