// app.js - 多模型图像/视频生成工具
const API_BASE = '/api';
const DL_ENDPOINT = '/dl';

// ========== DOM 引用 ==========
const modelSelect = document.getElementById('modelSelect');
const promptInput = document.getElementById('prompt');
const widthInput = document.getElementById('width');
const heightInput = document.getElementById('height');
const stepsInput = document.getElementById('steps');
const guidanceInput = document.getElementById('guidance');
const generateBtn = document.getElementById('generateBtn');
const outputArea = document.getElementById('outputArea');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const statusMsg = document.getElementById('statusMsg');
const timeCost = document.getElementById('timeCost');

// ========== 模型配置 ==========
const MODEL_CONFIGS = {
    'z-image': { defaultSteps: 9, guidanceScale: 0.0 },
    'flux-dev': { defaultSteps: 50, guidanceScale: 7.0 },      // 👈 新增
    'flux-schnell': { defaultSteps: 4, guidanceScale: 0.0 },   // 👈 新增
    'flux-2-dev': { defaultSteps: 28, guidanceScale: 7.0 },    // 👈 新增
    'edit-2511': { defaultSteps: 30, guidanceScale: 7.5 },
    'wan-video': { defaultSteps: 20, guidanceScale: 7.0 }
};

// ========== 模型切换 ==========
function onModelChange() {
    const key = modelSelect.value;
    const config = MODEL_CONFIGS[key];
    if (!config) return;
    if (stepsInput && config.defaultSteps !== undefined) {
        stepsInput.value = config.defaultSteps;
    }
    if (guidanceInput && config.guidanceScale !== undefined) {
        guidanceInput.value = config.guidanceScale;
    }
    // 显示/隐藏宽高参数
    const isVideo = key === 'wan-video';
    const isEdit = key === 'edit-2511';
    const widthGroup = document.getElementById('widthGroup');
    const heightGroup = document.getElementById('heightGroup');
    if (widthGroup) widthGroup.style.display = (isVideo || isEdit) ? 'none' : 'block';
    if (heightGroup) heightGroup.style.display = (isVideo || isEdit) ? 'none' : 'block';
    // 清空输出
    if (outputArea) {
        outputArea.innerHTML = '';
        outputArea.style.display = 'none';
    }
    setStatus('就绪');
}

modelSelect.addEventListener('change', onModelChange);
onModelChange();

// ========== 状态提示 ==========
function setStatus(text, color = '#3b82f6') {
    if (statusMsg) {
        statusMsg.textContent = text;
        statusMsg.style.color = color;
    }
}

// ========== 进度条 ==========
function updateProgress(percent, text) {
    if (!progressContainer) return;
    progressContainer.style.display = 'block';
    const clamped = Math.min(100, Math.max(0, percent));
    if (progressBar) progressBar.style.width = clamped + '%';
    if (progressText) progressText.textContent = text || Math.round(clamped) + '%';
}
function hideProgress() {
    if (progressContainer) progressContainer.style.display = 'none';
    if (progressBar) progressBar.style.width = '0%';
}

// ========== 核心生成函数 ==========
async function generateImage() {
    const apiKey = document.getElementById('apiKey')?.value?.trim();
    if (!apiKey) {
        alert('请先输入 API Key');
        return;
    }

    const modelKey = modelSelect.value;
    const prompt = promptInput?.value?.trim() || '';
    const width = parseInt(widthInput?.value) || 1024;
    const height = parseInt(heightInput?.value) || 1024;
    const steps = parseInt(stepsInput?.value) || 20;
    const guidance = parseFloat(guidanceInput?.value) || 7.0;

    if (!prompt) {
        alert('请输入提示词');
        return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = '⏳ 生成中...';
    setStatus('正在生成...', '#f59e0b');
    hideProgress();
    if (outputArea) {
        outputArea.innerHTML = '';
        outputArea.style.display = 'block';
    }

    const startTime = Date.now();

    try {
        const payload = {
            model: modelKey,
            prompt: prompt,
            width: width,
            height: height,
            num_inference_steps: steps,
            guidance_scale: guidance,
        };

        // FLUX 系列特殊处理
        if (modelKey.startsWith('flux-')) {
            payload.output_format = 'png';
        }

        updateProgress(10, '提交任务...');
        const submitRes = await fetch(`${API_BASE}/v1/images/generations`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!submitRes.ok) {
            const errText = await submitRes.text();
            let errMsg = `提交失败 (${submitRes.status})`;
            try {
                const errJson = JSON.parse(errText);
                errMsg = errJson.message || errJson.error || errText;
            } catch {
                errMsg = errText || errMsg;
            }
            throw new Error(errMsg);
        }

        const taskData = await submitRes.json();
        const taskId = taskData.task_id;
        if (!taskId) {
            if (taskData.output_images) {
                handleResult(taskData);
                return;
            }
            throw new Error('未获取到任务 ID');
        }

        setStatus(`处理中...`, '#f59e0b');
        updateProgress(20, `任务 ${taskId} 已提交`);

        let result = null;
        for (let i = 0; i < 90; i++) {
            await sleep(3000);
            const percent = 20 + (i / 90) * 70;
            updateProgress(percent, `等待中 ${i+1}/90`);

            const pollRes = await fetch(`${API_BASE}/v1/tasks/${taskId}`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'X-ModelScope-Task-Type': 'image_generation'
                }
            });

            if (pollRes.ok) {
                const pollData = await pollRes.json();
                if (pollData.task_status === 'SUCCEED') {
                    result = pollData;
                    break;
                } else if (pollData.task_status === 'FAILED') {
                    throw new Error(pollData.message || '生成失败');
                }
            }
        }

        if (!result) {
            throw new Error('生成超时，请重试');
        }

        handleResult(result);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        if (timeCost) timeCost.textContent = `⏱️ 上次耗时: ${elapsed}s`;

    } catch (e) {
        console.error('生成错误:', e);
        if (outputArea) {
            outputArea.innerHTML = `<div class="error">❌ ${e.message}</div>`;
            outputArea.style.display = 'block';
        }
        setStatus('错误', '#ef4444');
        hideProgress();
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = '🚀 生成图片/视频';
    }
}

// ========== 处理结果 ==========
function handleResult(data) {
    const images = data.output_images || data.images || [];
    if (images.length === 0) {
        outputArea.innerHTML = `<pre style="background:#f0f0f0;padding:12px;border-radius:8px;overflow:auto;max-height:400px;">${JSON.stringify(data, null, 2)}</pre>`;
        outputArea.style.display = 'block';
        setStatus('⚠️ 未知响应格式', '#f59e0b');
        hideProgress();
        return;
    }

    let html = `<div class="result-grid ${images.length > 1 ? 'cols-2' : 'cols-1'}">`;
    images.forEach((img, idx) => {
        const imgSrc = img.startsWith('data:') ? img : img;
        html += `
            <div class="result-item">
                <img src="${imgSrc}" alt="生成图片 ${idx+1}" onclick="openModal('${imgSrc}')" loading="lazy">
                <div class="item-actions">
                    <button onclick="downloadImage('${imgSrc}', ${idx+1})">📥 下载</button>
                </div>
            </div>
        `;
    });
    html += '</div>';

    outputArea.innerHTML = html;
    outputArea.style.display = 'block';
    setStatus(`✅ 生成成功！共 ${images.length} 张`, '#22c55e');
    updateProgress(100, '完成 ✅');
    setTimeout(hideProgress, 2000);
}

// ========== 辅助函数 ==========
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ========== 下载 ==========
window.downloadImage = function(dataUrl, index) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `image_${Date.now()}_${index}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ========== 图片预览 ==========
window.openModal = function(src) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    if (!modal || !modalImg) return;
    modalImg.src = src;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

document.getElementById('modalClose')?.addEventListener('click', function() {
    document.getElementById('imageModal').style.display = 'none';
    document.body.style.overflow = '';
});
document.getElementById('imageModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        this.style.display = 'none';
        document.body.style.overflow = '';
    }
});
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('imageModal');
        if (modal && modal.style.display === 'flex') {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }
});

// ========== 键盘快捷键 ==========
promptInput?.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        generateImage();
    }
});

// ========== 绑定生成事件 ==========
generateBtn?.addEventListener('click', generateImage);

// ========== 保存 API Key ==========
document.addEventListener('DOMContentLoaded', function() {
    const keyInput = document.getElementById('apiKey');
    if (keyInput) {
        const saved = localStorage.getItem('gitee_api_key');
        if (saved) keyInput.value = saved;
        keyInput.addEventListener('change', function() {
            localStorage.setItem('gitee_api_key', this.value.trim());
        });
    }
});

console.log('✅ 多模型工具已加载');
