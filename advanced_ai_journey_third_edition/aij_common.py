"""Shared helpers for the Advanced AI Journey notebooks. Presenters skip this on screen."""
import os, random
import numpy as np
import torch

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


def set_seed(seed=0):
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    if torch.cuda.is_available(): torch.cuda.manual_seed_all(seed)


def load_gpt2(name="gpt2", device=DEVICE, dtype=torch.float32, attn="sdpa"):
    """Return (tokenizer, model) for a GPT-2 checkpoint, in eval mode."""
    from transformers import AutoTokenizer, AutoModelForCausalLM
    from transformers.utils import logging
    logging.set_verbosity_error()
    tok = AutoTokenizer.from_pretrained(name)
    model = AutoModelForCausalLM.from_pretrained(name, dtype=dtype, attn_implementation=attn).eval().to(device)
    return tok, model
