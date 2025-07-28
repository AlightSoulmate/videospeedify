// ==UserScript==
// @name         VideoSpeedify
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  A script to adjust video playback speed on YouTube and Bilibili with a panel and keyboard shortcuts.
// @author       AlightSoulmate
// @match        https://www.youtube.com/watch*
// @match        https://www.bilibili.com/video/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function waitForVideo() {
        const video = document.querySelector('video');
        if (video) {
            initSpeedController(video);
        } else {
            setTimeout(waitForVideo, 1000);
        }
    }

    function initSpeedController(video) {
        const speedPanel = createSpeedPanel();
        attachPanelToVideo(video, speedPanel);
        setupKeyboardShortcuts(video);

        // Monitor Videos Switching
        const observer = new MutationObserver(() => {
            const newVideo = document.querySelector('video');
            if (newVideo && newVideo !== video) {
                initSpeedController(newVideo);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function attachPanelToVideo(video, speedPanel) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: relative; display: inline-block;';
        video.parentNode.insertBefore(wrapper, video);
        wrapper.appendChild(video);

        speedPanel.style.cssText += 'position: absolute; top: 30px; left: 5px; z-index: 100; pointer-events: auto;';
        speedPanel.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
        });
        wrapper.appendChild(speedPanel);
    }

    function createSpeedPanel() {
        const panel = document.createElement('div');
        panel.id = 'video-speed-panel';
        panel.style.cssText = `
            position: fixed; top: 100px; right: 20px; width: 100px;
            background: rgba(0, 0, 0, 0.8); color: white; padding: 15px;
            border-radius: 8px; font-size: 14px; z-index: 10000;
            font-family: Arial, sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        panel.innerHTML = `
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Speed:</label>
                <input type="number" id="custom-speed" min="0.1" max="10" step="0.1" value="1"
                style="width: 50px; padding: 3px; border: none; border-radius: 4px; color: #fff; background-color: #333;
                -webkit-appearance: none; -moz-appearance: textfield;"
                oninput="clearTimeout(this.timer); this.timer = setTimeout(() => { setVideoSpeed(this.value); updatePanelSpeed(this.value); }, 500);">
                <button id="apply-speed" style="margin-left: 4px; padding: 3px 8px; border: none;
                        border-radius: 4px; background: #00a1d69c; color: white; cursor: pointer;">&#8629;</button>
            </div>

            <div style="margin-bottom: 10px; text-align: center; position: relative;">
                <button id="shortcuts-info" style="background: none; border: 1px solid #666; color: #ccc; cursor: pointer;
                        font-size: 12px; padding: 4px 8px; border-radius: 4px;">
                    See Shortcuts
                </button>
                <div class="shortcuts-tooltip" style="
                    position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
                    background: rgba(0, 0, 0, 0.9); color: white; padding: 8px;
                    border-radius: 4px; font-size: 11px; line-height: 1.4;
                    white-space: nowrap; visibility: hidden; opacity: 0;
                    transition: opacity 0.3s; margin-bottom: 5px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3); z-index: 10001;
                ">
                    Ctrl + [ → Slower<br>
                    Ctrl + ] → Faster<br>
                    Ctrl + \\ → Reset(1.0x)
                    <div style="
                        position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
                        width: 0; height: 0; border-left: 5px solid transparent;
                        border-right: 5px solid transparent; border-top: 5px solid rgba(0, 0, 0, 0.9);
                    "></div>
                </div>
            </div>

            <div style="text-align: center; margin-top: 3px;">
                <button id="toggle-panel" style="background: none; border: none; color: #ccc; cursor: pointer; font-size: 12px; font-weight: bold;">
                    Collapse
                </button>
            </div>
        `;

        if (!document.querySelector('#speed-panel-style')) {
            const style = document.createElement('style');
            style.id = 'speed-panel-style';
            style.textContent = `
                .speed-btn {
                    padding: 5px 8px; border: none; border-radius: 4px;
                    background: #666; color: white; cursor: pointer;
                    font-size: 12px; transition: background 0.2s;
                }
                .speed-btn:hover { background: #00a1d6; }
                .speed-btn.active { background: #00a1d6; }
                #shortcuts-info:hover { border-color: #00a1d6; color: #00a1d6; }
            `;
            document.head.appendChild(style);
        }

        bindPanelEvents(panel);
        return panel;
    }

    function bindPanelEvents(panel) {
        const customSpeedInput = panel.querySelector('#custom-speed');
        const applyBtn = panel.querySelector('#apply-speed');
        const shortcutsBtn = panel.querySelector('#shortcuts-info');
        const tooltip = panel.querySelector('.shortcuts-tooltip');
        const toggleBtn = panel.querySelector('#toggle-panel');

        // Custom Speed
        function applyCustomSpeed() {
            let speed = parseFloat(customSpeedInput.value);
            if (speed < 0.2) {
                showToast('>= 0.2x only');
                customSpeedInput.value = '0.2';
                speed = 0.2;
            } else if (speed > 8) {
                showToast('Beyond 8.0x limit');
                customSpeedInput.value = '8';
                speed = 8;
            }
            speed = Math.round(speed * 10) / 10;
            setVideoSpeed(speed);
        }

        applyBtn.addEventListener('click', applyCustomSpeed);
        customSpeedInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') applyCustomSpeed();
        });

        // tooltip
        shortcutsBtn.addEventListener('mouseenter', () => {
            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '1';
        });
        shortcutsBtn.addEventListener('mouseleave', () => {
            tooltip.style.visibility = 'hidden';
            tooltip.style.opacity = '0';
        });

        // Collapse/Expand panel
        let isMinimized = false;
        toggleBtn.addEventListener('click', () => {
            const content = Array.from(panel.children).slice(0, -1);
            if (isMinimized) {
                content.forEach(el => el.style.display = 'block');
                toggleBtn.textContent = 'Collapse';
                panel.style.height = 'auto';
                panel.style.width = '100px';
            } else {
                content.forEach(el => el.style.display = 'none');
                toggleBtn.textContent = 'Expand';
                panel.style.height = '15px';
                panel.style.width = '60px';
            }
            isMinimized = !isMinimized;
        });
    }

    function setVideoSpeed(speed) {
        speed = Math.max(0.2, Math.min(8, Math.round(speed * 10) / 10));
        const video = document.querySelector('video');
        if (video) {
            video.playbackRate = speed;
            showToast(`Speed: ${speed.toFixed(1)}x`);
            updatePanelSpeed(speed);
        }
    }

    function showToast(message) {
        const existingToast = document.querySelector('#speed-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.id = 'speed-toast';
        toast.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8); color: white; padding: 10px 20px;
            border-radius: 6px; font-size: 16px; font-weight: bold;
            z-index: 10000000; transition: opacity 0.3s;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    function setupKeyboardShortcuts(video) {
        document.addEventListener('keydown', (e) => {
            let currentSpeed = video.playbackRate || 1;

            if (e.ctrlKey && e.key === '[') {
                e.preventDefault();
                currentSpeed = Math.max(0.2, currentSpeed - 0.1);
                setVideoSpeed(currentSpeed);
            } else if (e.ctrlKey && e.key === ']') {
                e.preventDefault();
                currentSpeed = Math.min(8, currentSpeed + 0.1);
                setVideoSpeed(currentSpeed);
            } else if (e.ctrlKey && e.code === 'Backslash') {
                e.preventDefault();
                setVideoSpeed(1);
            }
        });
    }

    function updatePanelSpeed(speed) {
        const panel = document.querySelector('#video-speed-panel');
        if (panel) {
            const customSpeedInput = panel.querySelector('#custom-speed');
            if (customSpeedInput) {
                customSpeedInput.value = speed.toFixed(1);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForVideo);
    } else {
        waitForVideo();
    }

})();