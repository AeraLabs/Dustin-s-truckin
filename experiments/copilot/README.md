# Removable phone Copilot experiment

Open the existing HTTPS app in Android Chrome and choose Settings → Try phone Copilot, or add `?copilot=1` to its URL. No desktop, Ollama server, subscription or AI API key is needed.

1. While parked, use Wi-Fi and tap **Download / load local AI**. Allow roughly 250 MB for the first download (model weights alone are 182 MB), plus working memory. Keep the tab visible. Nothing downloads until this button is pressed.
2. Wait for **Local model ready · CPU mode**. A quantized SmolLM2-135M-Instruct runs in a dedicated Web Worker using single-threaded WASM, avoiding Android WebGPU dependencies. First load and inference speed depend on the phone.
3. Type an exact command such as `dark mode`, `zoom in`, `show truck parking`, `show rest areas`, `open trip planner`, or `open official sources`. These use deterministic commands and work even without the model. Other wording runs through the model; review and tap **Apply suggested action**. This small model can misclassify or refuse commands.
4. For voice, explicitly allow browser speech input, then tap **Tap to speak** and grant microphone permission. Speech recognition may send audio to the browser's provider; this is not fully offline voice. No wake word or background listening. Replies use an available local English device voice only when enabled.
5. **Stop AI / audio**, closing the panel, hiding the tab, or leaving the page terminates the worker and microphone. Stop during a download or request discards pending actions. Nothing automatically restarts.
6. **Remove downloaded model & disable** terminates the worker and deletes this experiment's separate model cache. It preserves saved trips, map caches and preferences. CDN/runtime resources may remain in normal browser HTTP cache, managed by the browser. Removal failure is displayed rather than silently reported as success.

The model receives only the command text, not GPS, routes, API keys or road data. CDN/Hugging Face receive asset download requests. No transcripts are stored by this app. Existing map providers continue their usual requests. The experiment does not answer road-safety questions, choose routes, certify clearance, or implement monitoring. Place commands show facilities around the existing map view; they cannot verify parking availability.

## Full code removal

Remove the `experiments/copilot/loader.js?v=1` script tag in `index.html` and its entry in `sw.js`, increment the service-worker cache version, then delete `experiments/copilot/` and `tests/copilot.test.cjs`. Alternatively revert the single experiment commit. The existing app has no other dependency on this feature. Remove the model through the UI before removing code if you want to recover its cache immediately.

## Verification

Run `node --test tests/*.test.cjs`. Test on an actual Android phone: first download, reload/reuse, airplane-mode failure, denied microphone, low-memory/model failure, stop mid-download, background tab cancellation, remove cache, and ordinary map behavior with the experiment off. Desktop/mobile viewport automation cannot establish S22 performance, microphone quality or battery behavior.

Pinned runtime: Transformers.js 3.8.1. Pinned model: HuggingFaceTB/SmolLM2-135M-Instruct at `12fd25f77366fa6b3b4b768ec3050bf629380bac`, q4. Model license: Apache-2.0 (see upstream model card). Sources: https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct and https://huggingface.co/docs/transformers.js and https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition.
