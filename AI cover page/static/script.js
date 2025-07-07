const form = document.getElementById('cover-form');
const resultSection = document.getElementById('result');
const errorDiv = document.getElementById('error');
const loadingDiv = document.getElementById('loading');
const generateBtn = document.getElementById('generate-btn');
const regenerateBtn = document.getElementById('regenerate-btn');
const copyPromptBtn = document.getElementById('copy-prompt-btn');
const downloadAllBtn = document.getElementById('download-all-btn');
const historySection = document.getElementById('history');
const historyList = document.getElementById('history-list');

let lastRequest = null;
let lastImages = [];
let history = [];

function setFormDisabled(disabled) {
    generateBtn.disabled = disabled;
    regenerateBtn.disabled = disabled;
    Array.from(form.elements).forEach(el => el.disabled = disabled);
}

function showSpinner(show) {
    loadingDiv.style.display = show ? 'block' : 'none';
}

function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
}

function hideError() {
    errorDiv.textContent = '';
    errorDiv.style.display = 'none';
}

function showActions(show) {
    copyPromptBtn.style.display = show ? 'inline-block' : 'none';
    downloadAllBtn.style.display = show ? 'inline-block' : 'none';
    regenerateBtn.style.display = show ? 'inline-block' : 'none';
}

function addToHistory(entry) {
    history.unshift(entry);
    if (history.length > 10) history.pop();
    renderHistory();
}

function renderHistory() {
    if (history.length === 0) {
        historySection.style.display = 'none';
        return;
    }
    historySection.style.display = 'block';
    historyList.innerHTML = '';
    history.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.tabIndex = 0;
        div.setAttribute('role', 'button');
        div.setAttribute('aria-label', `Show history item ${idx + 1}`);
        div.title = 'Click to restore this result';
        div.onclick = () => {
            renderImages(item.images, item.prompt, item.negative, item.size);
            lastRequest = item.request;
            lastImages = item.images;
            showActions(true);
        };
        item.images.slice(0, 1).forEach(b64 => {
            const img = document.createElement('img');
            img.src = `data:image/png;base64,${b64}`;
            img.className = 'history-thumb';
            img.alt = 'History thumbnail';
            div.appendChild(img);
        });
        const meta = document.createElement('div');
        meta.className = 'history-meta';
        meta.textContent = `${item.prompt.slice(0, 30)}...`;
        div.appendChild(meta);
        historyList.appendChild(div);
    });
}

function renderImages(images, prompt, negative, size) {
    resultSection.innerHTML = '';
    images.forEach((b64, idx) => {
        const url = `data:image/png;base64,${b64}`;
        const card = document.createElement('div');
        card.className = 'cover-card fade-in';
        const img = document.createElement('img');
        img.className = 'cover-image';
        img.src = url;
        img.alt = prompt + ' cover variation ' + (idx+1);
        const meta = document.createElement('div');
        meta.className = 'cover-meta';
        meta.innerHTML = `<strong>Prompt:</strong> ${prompt}<br>` +
            (negative ? `<strong>Negative:</strong> ${negative}<br>` : '') +
            `<strong>Size:</strong> ${size}`;
        const downloadBtn = document.createElement('a');
        downloadBtn.href = url;
        downloadBtn.download = `cover${idx+1}.png`;
        downloadBtn.className = 'download-btn';
        downloadBtn.textContent = 'Download PNG';
        card.appendChild(img);
        card.appendChild(meta);
        card.appendChild(downloadBtn);
        resultSection.appendChild(card);
    });
    lastImages = images;
    showActions(true);
}

async function handleSubmit(request) {
    hideError();
    resultSection.innerHTML = '';
    showSpinner(true);
    setFormDisabled(true);
    showActions(false);
    try {
        const response = await fetch('/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });
        if (!response.ok) {
            let errMsg = 'Image generation failed.';
            try {
                const err = await response.json();
                errMsg = err.error || errMsg;
            } catch {}
            throw new Error(errMsg);
        }
        const resJson = await response.json();
        if (!resJson.images || !Array.isArray(resJson.images) || resJson.images.length === 0) {
            throw new Error('No images returned.');
        }
        renderImages(resJson.images, resJson.prompt, resJson.negative, resJson.size);
        lastRequest = request;
        addToHistory({ images: resJson.images, prompt: resJson.prompt, negative: resJson.negative, size: resJson.size, request });
    } catch (err) {
        showError(err.message || 'Error generating image.');
    } finally {
        showSpinner(false);
        setFormDisabled(false);
    }
}

form.addEventListener('submit', function(e) {
    e.preventDefault();
    const request = {
        title: form.title.value,
        subtitle: form.subtitle.value,
        genre: form.genre.value,
        mood: form.mood.value,
        format: form.format.value,
        style: form.style.value,
        negative: form.negative.value,
        size: form.size.value,
        variations: form.variations.value
    };
    handleSubmit(request);
});

regenerateBtn.addEventListener('click', function() {
    if (lastRequest) {
        handleSubmit(lastRequest);
    }
});

copyPromptBtn.addEventListener('click', function() {
    if (!lastRequest) return;
    let prompt = `${lastRequest.format} cover, title: ${lastRequest.title}`;
    if (lastRequest.subtitle) prompt += `, subtitle: ${lastRequest.subtitle}`;
    if (lastRequest.genre) prompt += `, genre: ${lastRequest.genre}`;
    if (lastRequest.mood) prompt += `, mood: ${lastRequest.mood}`;
    if (lastRequest.style) prompt += `, style: ${lastRequest.style}`;
    if (lastRequest.negative) prompt += `\nNegative: ${lastRequest.negative}`;
    prompt += `\nSize: ${lastRequest.size}`;
    navigator.clipboard.writeText(prompt);
    copyPromptBtn.textContent = 'Copied!';
    setTimeout(() => { copyPromptBtn.textContent = 'Copy Prompt'; }, 1200);
});

downloadAllBtn.addEventListener('click', async function() {
    if (!lastImages || lastImages.length === 0) return;
    // Dynamically import JSZip only when needed
    if (!window.JSZip) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
        script.onload = downloadAllAsZip;
        document.body.appendChild(script);
    } else {
        downloadAllAsZip();
    }
});

function downloadAllAsZip() {
    const zip = new window.JSZip();
    lastImages.forEach((b64, idx) => {
        zip.file(`cover${idx+1}.png`, b64ToBlob(b64), {binary: true});
    });
    zip.generateAsync({type: 'blob'}).then(function(content) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = 'covers.zip';
        a.click();
    });
}

function b64ToBlob(b64) {
    const byteCharacters = atob(b64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], {type: 'image/png'});
}

// Spinner animation
(function addSpinnerCSS() {
    const style = document.createElement('style');
    style.innerHTML = `.spinner {display:inline-block;width:22px;height:22px;border:3px solid #b3b3ff;border-top:3px solid #6366f1;border-radius:50%;animation:spin 1s linear infinite;vertical-align:middle;margin-right:8px;}@keyframes spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}.fade-in{animation:fadeIn 0.7s;}.history-item{display:inline-block;margin:0 8px 8px 0;cursor:pointer;vertical-align:top;}.history-thumb{width:40px;height:40px;object-fit:cover;border-radius:5px;box-shadow:0 1px 4px #bbb;}.history-meta{font-size:0.8em;color:#555;margin-top:2px;}.cover-meta{font-size:0.95em;color:#444;margin-bottom:6px;}@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}`;
    document.head.appendChild(style);
})();

// Enhanced Dark mode toggle
const darkToggle = document.getElementById('dark-mode-toggle');
const moonIcon = darkToggle.querySelector('.icon-moon');
const sunIcon = darkToggle.querySelector('.icon-sun');

function setTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    
    // Update button icons
    if (isDark) {
        moonIcon.style.display = 'none';
        sunIcon.style.display = 'inline';
        darkToggle.setAttribute('title', 'Switch to Light Mode');
    } else {
        moonIcon.style.display = 'inline';
        sunIcon.style.display = 'none';
        darkToggle.setAttribute('title', 'Switch to Dark Mode');
    }
    
    // Save preference
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const isDark = currentTheme === 'dark';
    setTheme(!isDark);
}

// Initialize theme on page load
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Use saved theme, or system preference, or default to light
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(theme === 'dark');
}

// Event listeners
darkToggle.addEventListener('click', toggleTheme);

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
        setTheme(e.matches);
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeTheme);

// Modal image preview
const modal = document.getElementById('modal');
const modalImg = document.getElementById('modal-img');
const modalClose = document.getElementById('modal-close');
function openModal(src, alt) {
  modalImg.src = src;
  modalImg.alt = alt || 'Preview';
  modal.style.display = 'flex';
  modalImg.focus();
}
function closeModal() {
  modal.style.display = 'none';
  modalImg.src = '';
}
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (modal.style.display === 'flex' && (e.key === 'Escape' || e.key === 'Esc')) closeModal();
});

// Attach modal preview to result images and history thumbnails
document.addEventListener('click', function(e) {
  if (e.target.matches('.result img')) {
    openModal(e.target.src, e.target.alt);
  }
  if (e.target.matches('.history-list img')) {
    openModal(e.target.src, e.target.alt);
  }
});

// Helper to render result images as cards
function renderResults(images) {
  const result = document.getElementById('result');
  result.innerHTML = '';
  images.forEach((img, i) => {
    const card = document.createElement('div');
    card.className = 'cover-card';
    const image = document.createElement('img');
    image.src = img.url;
    image.alt = img.alt || `Generated cover ${i+1}`;
    image.className = 'cover-image';
    card.appendChild(image);
    if (img.meta) {
      const meta = document.createElement('div');
      meta.className = 'cover-meta';
      meta.textContent = img.meta;
      card.appendChild(meta);
    }
    const btn = document.createElement('a');
    btn.href = img.url;
    btn.download = img.downloadName || `cover_${i+1}.png`;
    btn.className = 'download-btn';
    btn.innerHTML = '<span class="btn-icon">⬇️</span> Download';
    card.appendChild(btn);
    result.appendChild(card);
  });
} 