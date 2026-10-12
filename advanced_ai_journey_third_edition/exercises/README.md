# Your turn: practice for the advanced course

One short notebook per session (`a00_your_turn.ipynb` to `a13_your_turn.ipynb`), a bug hunt, and a capstone.

- **These notebooks never re-run a session.** The sessions are heavy and are read from their saved outputs. Each task works from small arrays built inside the notebook, from plain arithmetic, or from GPT-2's tokenizer (it downloads once). No GPU and none of the course's `cache/` files are needed.
- **Your turn notebooks.** Replace every `...` with your own code and run the check under it: `PASS` or `FAIL` with a hint.
- **Solutions** are in `solutions/`, each with a short note on why it works. Try the task first.
- **`bug_hunt.ipynb`** is a small language-model project with five planted mistakes (a missing causal mask, a mismatched tokenizer, padding on the wrong side, an evaluation set that overlaps the training data, and a hand-written chat template). It needs GPT-2 small, BERT's tokenizer and Qwen2.5-0.5B-Instruct's tokenizer, and runs on a CPU. The answers are in `solutions/bug_hunt_answers.ipynb`.
- **`capstone/`** has a brief, a rubric and a paper-map template: reproduce one claim from a paper at small scale with the method of Sessions 11 and 12.

Keep `aij_check.py` in the same folder as the notebooks. The requirements are those of the course (`../requirements.txt`).
