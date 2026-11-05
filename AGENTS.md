# Architecture rules
- Keep global administration authorization in the core service and a caller-checked database function using separate global roles; team roles must never grant global access.
- Place new signed-in screens under the pathless `_authenticated` layout and call authenticated server functions for initial data through query loaders.