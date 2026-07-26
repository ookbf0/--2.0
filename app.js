// app.js - 多模型图像/视频生成工具 (已添加 FLUX 系列模型)
// 配置 API 基础路径（使用 Pages Functions 代理）
const API_BASE = '/api';
const DL_ENDPOINT = '/dl';

// ========== 模型配置 ==========
// 注意: 所有模型 ID 均来自 ai.gitee.com 平台
const MODELS = {
    // ---- 文生图模型 ----
    'z-image': {
        id: 'z-image',
        name: 'Z-Image-Turbo (文生图)',
        type: 'text-to-image',
        defaultSteps: 9,
        guidanceScale: 0.0,
        description: '快速文生图，Turbo 蒸馏版'
    },
    'flux-dev': {
        id: 'FLUX.1-dev',
        name: 'FLUX.1-dev (文生图)',
        type: 'text-to-image',
        defaultSteps: 50,
        guidanceScale: 7.0,
        description: '高画质开源模型，非商用'
    },
    'flux-schnell': {
        id: 'FLUX.1-schnell',
        name: 'FLUX.1-schnell (文生图)',
        type: 'text-to-image',
        defaultSteps: 4,
        guidanceScale: 0.0,
        description: '极速生成，1-4 步出图'
    },
    'flux-2-dev': {
        id: 'FLUX.2-dev',
        name: 'FLUX.2-dev (文生图)',
        type: 'text-to-image',
        defaultSteps: 28,
        guidanceScale: 7.0,
        description: '最新一代，画面一致性更强'
    },
    // ---- 图像编辑模型 ----
    'edit-2511': {
        id: 'edit-2511',
        name: 'Edit-2511 (图像编辑)',
        type: 'image-editing',
        defaultSteps: 30,
        guidanceScale: 7.5,
        description: '基于两张图 + prompt 进行编辑'
    },
    // ---- 图生视频模型 ----
    'wan-video': {
        id: 'Wan2.2',
        name: 'Wan2.2 (图生视频)',
        type: 'video-generation',
        defaultSteps: 20,
        description: '按 Duration 分段生成视频'
    }
};

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

// ========== 初始化模型下拉菜单 ==========
function initModelSelect() {
    if (!modelSelect) return;
    modelSelect.innerHTML = '';
    // 按类型分组添加
    const groups = [
        { label: '文生图', keys: ['z-image', 'flux-dev', 'flux-schnell', 'flux-2-dev'] },
        { label: '图像编辑', keys: ['edit-2511'] },
        { label: '图生视频', keys: ['wan-video'] }
    ];
    groups.forEach(group => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = group.label;
        group.keys.forEach(key => {
            const model = MODELS[key];
            if (!model) return;
            const option = document.createElement('option');
            option.value = key;
            option.textContent = model.name;
            if (key === 'z-image') option.selected = true;
            optgroup.appendChild(option);
        });
        modelSelect.appendChild(optgroup);
    });
    // 默认选中 z-image
    modelSelect.value = 'z-image';
    // 切换模型时更新参数显示
    modelSelect.addEventListener('change', onModelChange);
    onModelChange();
}

// ========== 模型切换回调 ==========
function onModelChange() {
    const key = modelSelect.value;
    const model = MODELS[key];
    if (!model) return;
    // 更新步数
    if (stepsInput && model.defaultSteps !== undefined) {
        stepsInput.value = model.defaultSteps;
    }
    // 更新引导比例
    if (guidanceInput && model.guidanceScale !== undefined) {
        guidanceInput.value = model.guidanceScale;
    }
    // 显示/隐藏相关参数（视频和图像编辑需要特殊UI）
    const isVideo = model.type === 'video-generation';
    const isEdit = model.type === 'image-editing';
    // 可以根据模型类型显示/隐藏对应的UI元素
    const widthGroup = document.getElementById('widthGroup');
    const heightGroup = document.getElementById('heightGroup');
    if (widthGroup) widthGroup.style.display = (isVideo || isEdit) ? 'none' : 'flex';
    if (heightGroup) heightGroup.style.display = (isVideo || isEdit) ? 'none' : 'flex';
    // 视频/编辑特殊提示
    if (isVideo) {
        setStatus('📹 图生视频模式，请上传初始图片', '#8b5cf6');
    } else if (isEdit) {
        setStatus('✏️ 图像编辑模式，请上传两张图片', '#8b5cf6');
    } else {
        setStatus('就绪', '#22c55e');
    }
    // 清空输出区域
    if (outputArea) {
        outputArea.innerHTML = '';
        outputArea.style.display = 'none';
    }
}

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
    const modelKey = modelSelect.value;
    const model = MODELS[modelKey];
    if (!model) {
        alert('请选择有效的模型');
        return;
    }

    // 获取 API Key
    const apiKey = document.getElementById('apiKey')?.value?.trim();
    if (!apiKey) {
        alert('请先输入 API Key');
        return;
    }

    // 获取基础参数
    const prompt = promptInput?.value?.trim() || '';
    const width = parseInt(widthInput?.value) || 1024;
    const height = parseInt(heightInput?.value) || 1024;
    const steps = parseInt(stepsInput?.value) || model.defaultSteps || 20;
    const guidance = parseFloat(guidanceInput?.value) || model.guidanceScale || 7.0;

    // 验证: 文本生成类必须要有提示词
    if (model.type === 'text-to-image' && !prompt) {
        alert('请输入提示词');
        return;
    }

    // 禁用按钮
    generateBtn.disabled = true;
    generateBtn.textContent = '⏳ 生成中...';
    setStatus('正在生成...', '#f59e0b');
    hideProgress();
    if (outputArea) {
        outputArea.innerHTML = '';
        outputArea.style.display = 'block';
    }

    try {
        // ---- 构建请求体（根据模型类型） ----
        let payload = {};
        const basePayload = {
            model: model.id,
            prompt: prompt,
            num_inference_steps: steps,
            guidance_scale: guidance,
        };

        if (model.type === 'text-to-image') {
            payload = {
                ...basePayload,
                width: width,
                height: height,
                // FLUX 系列可能需要额外参数
                ...(model.id.startsWith('FLUX.') ? { output_format: 'png' } : {})
            };
        } else if (model.type === 'image-editing') {
            // 图像编辑需要两张图，此处简化，实际需从UI获取
            // 这里保留接口，实际使用时需要添加上传图片逻辑
            payload = {
                ...basePayload,
                image_urls: [], // 需用户上传
                task_types: ['background_remove', 'object_replace'] // 示例
            };
            alert('图像编辑功能需要上传图片，请完善UI后使用');
            throw new Error('图像编辑功能暂未完全实现');
        } else if (model.type === 'video-generation') {
            // 图生视频
            payload = {
                ...basePayload,
                duration: 5, // 秒
                // 需要初始图片
            };
            alert('图生视频功能需要上传初始图片，请完善UI后使用');
            throw new Error('图生视频功能暂未完全实现');
        }

        // ---- 发送请求 ----
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
            // 有些模型可能直接返回结果而非任务ID
            if (taskData.output_images || taskData.image || taskData.video_url) {
                // 直接处理结果
                handleDirectResult(taskData);
                return;
            }
            throw new Error('未获取到任务 ID，请检查 API 响应');
        }

        setStatus(`处理中 (${model.name})...`, '#f59e0b');
        updateProgress(20, `任务 ${taskId} 已提交`);

        // ---- 轮询结果 ----
        let result = null;
        const maxAttempts = 90; // 最多等待约 4.5 分钟 (90 * 3s)
        for (let i = 0; i < maxAttempts; i++) {
            await sleep(3000);
            const percent = 20 + (i / maxAttempts) * 70;
            updateProgress(percent, `等待中 ${i+1}/${maxAttempts}`);

            const pollRes = await fetch(`${API_BASE}/v1/tasks/${taskId}`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'X-ModelScope-Task-Type': model.type === 'video-generation' ? 'video_generation' : 'image_generation'
                }
            });

            if (pollRes.ok) {
                const pollData = await pollRes.json();
                const status = pollData.task_status;
                if (status === 'SUCCEED') {
                    result = pollData;
                    break;
                } else if (status === 'FAILED') {
                    throw new Error(pollData.message || '生成失败');
                } else if (status === 'PENDING' || status === 'PROCESSING') {
                    // 继续等待
                    continue;
                }
            } else if (pollRes.status === 404) {
                // 任务可能还未创建，继续等待
                continue;
            } else {
                const errText = await pollRes.text();
                console.warn(`轮询状态码 ${pollRes.status}:`, errText);
            }
        }

        if (!result) {
            throw new Error('生成超时（约4.5分钟），请稍后重试');
        }

        // ---- 处理结果 ----
        handleDirectResult(result);

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
        if (!document.querySelector('.error')) {
            // 如果没有错误，但也没有成功，恢复状态
        }
    }
}

// ========== 处理直接结果（非轮询） ==========
function handleDirectResult(data) {
    // 判断结果类型
    const images = data.output_images || data.images || [];
    const videoUrl = data.video_url || data.video || data.output_video || null;

    if (images.length > 0) {
        // 显示图片
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
        if (outputArea) {
            outputArea.innerHTML = html;
            outputArea.style.display = 'block';
        }
        setStatus(`✅ 生成成功！共 ${images.length} 张`, '#22c55e');
        updateProgress(100, '完成 ✅');
        setTimeout(hideProgress, 2000);
        // 保存历史 (可扩展)
        return;
    }

    if (videoUrl) {
        // 显示视频
        const videoHtml = `
            <div class="result-item">
                <video controls autoplay loop style="max-width:100%; border-radius:8px;">
                    <source src="${videoUrl}" type="video/mp4">
                    您的浏览器不支持视频播放
                </video>
                <div class="item-actions">
                    <button onclick="downloadVideo('${videoUrl}')">📥 下载视频</button>
                </div>
            </div>
        `;
        if (outputArea) {
            outputArea.innerHTML = videoHtml;
            outputArea.style.display = 'block';
        }
        setStatus('✅ 视频生成成功！', '#22c55e');
        updateProgress(100, '完成 ✅');
        setTimeout(hideProgress, 2000);
        return;
    }

    // 如果什么都没有，显示原始数据
    if (outputArea) {
        outputArea.innerHTML = `<pre style="background:#f0f0f0; padding:12px; border-radius:8px; overflow:auto; max-height:400px;">${JSON.stringify(data, null, 2)}</pre>`;
        outputArea.style.display = 'block';
    }
    setStatus('⚠️ 未知响应格式', '#f59e0b');
    hideProgress();
}

// ========== 辅助函数 ==========
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ========== 下载功能 ==========
window.downloadImage = function(dataUrl, index) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `image_${Date.now()}_${index}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.downloadVideo = function(videoUrl) {
    // 通过代理下载
    fetch(`${DL_ENDPOINT}?url=${encodeURIComponent(videoUrl)}`)
        .then(res => res.blob())
        .then(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `video_${Date.now()}.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        })
        .catch(e => alert('下载失败: ' + e.message));
};

// ========== 图片预览模态框 ==========
window.openModal = function(src) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    if (!modal || !modalImg) {
        // 如果不存在模态框，用新窗口打开
        window.open(src, '_blank');
        return;
    }
    modalImg.src = src;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    // 重置缩放
    modalImg.style.transform = 'scale(1)';
    modalImg.dataset.scale = 1;
};

// 关闭模态框
document.addEventListener('click', function(e) {
    const modal = document.getElementById('imageModal');
    if (e.target === modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
});

// ESC 关闭
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('imageModal');
        if (modal && modal.style.display === 'flex') {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }
});

// 滚轮缩放
document.addEventListener('DOMContentLoaded', function() {
    const modalImg = document.getElementById('modalImage');
    if (modalImg) {
        modalImg.addEventListener('wheel', function(e) {
            e.preventDefault();
            const scale = parseFloat(this.dataset.scale) || 1;
            let newScale = scale;
            if (e.deltaY < 0) newScale = Math.min(5, scale * 1.1);
            else newScale = Math.max(0.5, scale / 1.1);
            this.dataset.scale = newScale;
            this.style.transform = `scale(${newScale})`;
        }, { passive: false });

        // 双击重置
        modalImg.addEventListener('dblclick', function() {
            this.dataset.scale = 1;
            this.style.transform = 'scale(1)';
        });
    }
});

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', function() {
    initModelSelect();
    setStatus('就绪', '#22c55e');
    hideProgress();
    // 如果没有 API Key 输入框，可以添加默认提示
    const keyInput = document.getElementById('apiKey');
    if (keyInput) {
        // 从 localStorage 恢复
        const savedKey = localStorage.getItem('gitee_api_key');
        if (savedKey) keyInput.value = savedKey;
        keyInput.addEventListener('change', function() {
            localStorage.setItem('gitee_api_key', this.value.trim());
        });
    }
});

// ========== 绑定生成事件 ==========
if (generateBtn) {
    generateBtn.addEventListener('click', generateImage);
}

// ========== 快捷键 (Ctrl+Enter) ==========
if (promptInput) {
    promptInput.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            generateImage();
        }
    });
}

// ========== 暴露部分功能给全局 ==========
window.generateImage = generateImage;
window.setStatus = setStatus;
window.updateProgress = updateProgress;
window.hideProgress = hideProgress;
window.MODELS = MODELS;

console.log('✅ 多模型工具已加载，当前模型列表:', Object.keys(MODELS));
console.log('📌 使用说明: 选择模型 -> 填写参数 -> 点击生成');
