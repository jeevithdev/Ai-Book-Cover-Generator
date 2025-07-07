import os
import requests
from flask import Flask, request, render_template, send_file, jsonify
from io import BytesIO
import base64

app = Flask(__name__)

# Updated Stability AI API endpoint and engine
STABILITY_API_KEY = "sk-ZRWClnQEedHKVvW0JyqbgH7UQ2mKWLvnkukOZiFMCmrTDHpZ"
STABILITY_ENGINE_ID = "stable-diffusion-xl-1024-v1-0"
STABILITY_API_URL = f"https://api.stability.ai/v1/generation/{STABILITY_ENGINE_ID}/text-to-image"

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/generate", methods=["POST"])
def generate():
    data = request.json
    prompt = f"{data.get('format', '')} cover, title: {data.get('title', '')}"
    if data.get('subtitle'):
        prompt += f", subtitle: {data['subtitle']}"
    if data.get('genre'):
        prompt += f", genre: {data['genre']}"
    if data.get('mood'):
        prompt += f", mood: {data['mood']}"
    if data.get('style'):
        prompt += f", style: {data['style']}"

    # Parse new fields
    negative_prompt = data.get('negative', '').strip()
    size = data.get('size', '1024x1024')
    try:
        width, height = map(int, size.lower().split('x'))
    except Exception:
        width, height = 1024, 1024
    try:
        variations = max(1, min(4, int(data.get('variations', 3))))
    except Exception:
        variations = 3

    headers = {
        "Authorization": f"Bearer {STABILITY_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    payload = {
        "text_prompts": [{"text": prompt}],
        "cfg_scale": 7,
        "clip_guidance_preset": "FAST_BLUE",
        "height": height,
        "width": width,
        "samples": variations,
        "steps": 30
    }
    if negative_prompt:
        payload["text_prompts"].append({"text": negative_prompt, "weight": -1})
    response = requests.post(STABILITY_API_URL, headers=headers, json=payload)
    if response.status_code != 200:
        try:
            error_json = response.json()
            error_msg = error_json.get('message', 'Image generation failed.')
        except Exception:
            error_msg = 'Image generation failed (unknown error).'
        return jsonify({"error": error_msg}), 500
    result = response.json()
    if not result.get('artifacts'):
        return jsonify({"error": "No image returned from Stability AI."}), 500
    images_b64 = [a['base64'] for a in result['artifacts'] if a.get('base64')]
    if not images_b64:
        return jsonify({"error": "No image returned from Stability AI."}), 500
    # Return all images as base64 in JSON
    return jsonify({"images": images_b64, "prompt": prompt, "negative": negative_prompt, "size": f"{width}x{height}"})

if __name__ == "__main__":
    app.run(debug=True) 