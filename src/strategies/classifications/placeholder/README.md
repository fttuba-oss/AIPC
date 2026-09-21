# Classification Module Template / Placeholder

This directory demonstrates how any future problem classification can be added to the AIPC Practice Strategies Engine.

When you are ready to define a new classification (e.g., `classification_name`):

1. Create a folder: `src/classifications/<classification_name>/`
2. Implement:
   - `types/`: Domain capacities, problem signatures, and assistance configurations.
   - `registry/`: Strategy catalog for the domain.
   - `selector/`: Strategy selector mapping diagnostic evidence to targeted strategies.
   - `strategies/`: Concrete strategies extending `BaseStrategy`.
   - `scaffolds/`: Domain-specific exercise and audio/score transformations.
   - `agent/`: Classification agent extending `BaseClassificationAgent`.
3. Register the agent in `ClassificationRouter`:
   ```typescript
   router.registerClassification(new YourClassificationAgent());
   ```
Core fading state machine (`FadingController`), session tracking (`StrategySession`), and portal bridge contracts require zero changes.
