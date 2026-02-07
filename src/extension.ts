import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// دالة مساعدة للانتظار
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

let lastLanguage: 'Arabic' | 'English' | 'None' = 'None';
let statusBarItem: vscode.StatusBarItem;

// متغيرات لتجنب التبديل المتكرر
let lastSwitchedLine = -1; // تتبع آخر سطر تم التبديل فيه
let isSwitching = false;
let switchingTimeout: NodeJS.Timeout | null = null; // مهلة زمنية لإعادة تعيين isSwitching

// اكتشاف نظام التشغيل
const platform = os.platform();

export function activate(context: vscode.ExtensionContext) {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBarItem);
    updateStatusBar('Ready', 'None');

    let disposable = vscode.window.onDidChangeTextEditorSelection(async (event) => {
        const editor = event.textEditor;
        const settings = vscode.workspace.getConfiguration('autolanguage');

        if (!settings.get('enabled')) {
            updateStatusBar('Disabled', 'None');
            lastSwitchedLine = -1;
            return;
        }

        // تجنب التبديل المتكرر
        if (isSwitching) {
            updateStatusBar('Active', lastLanguage);
            return;
        }

        const selection = event.selections[0];
        const document = editor.document;
        const currentLine = selection.active.line;

        // التبديل فقط عند الانتقال لسطر جديد
        if (currentLine === lastSwitchedLine) {
            updateStatusBar('Active', lastLanguage);
            return;
        }

        // كشف اللغة في السطر الجديد
        const lang = detectLanguageInLine(document, currentLine);

        // التبديل فقط إذا كانت اللغة مختلفة وليست None
        if (lang !== 'None' && lang !== lastLanguage) {
            isSwitching = true;
            lastSwitchedLine = currentLine;

            // تعيين مهلة زمنية لإعادة تعيين isSwitching في حالة عدم اكتمال العملية
            if (switchingTimeout) {
                clearTimeout(switchingTimeout);
            }
            switchingTimeout = setTimeout(() => {
                isSwitching = false;
                switchingTimeout = null;
            }, 2000); // مهلة 2 ثانية

            try {
                if (lang === 'Arabic') {
                    await switchToArabic();
                } else if (lang === 'English') {
                    await switchToEnglish();
                }

                lastLanguage = lang;

                if (settings.get('showNotifications')) {
                    const icon = lang === 'Arabic' ? '$(symbol-namespace)' : '$(symbol-enum)';
                    const translate = lang === "Arabic" ? "تم تغيير اللغة الى العربية" : 'Language Switched to English';
                    vscode.window.showInformationMessage(`${translate}`);
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                if (errorMessage.includes('not installed') || errorMessage.includes('not found')) {
                    const platformName = platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : 'Linux';
                    vscode.window.showErrorMessage(`Auto Language: ${errorMessage} Please add the keyboard layout in ${platformName} Settings.`);
                } else {
                    vscode.window.showErrorMessage(`Auto Language: ${errorMessage}`);
                }
                lastSwitchedLine = -1;
            } finally {
                isSwitching = false;
                if (switchingTimeout) {
                    clearTimeout(switchingTimeout);
                    switchingTimeout = null;
                }
            }
        }

        updateStatusBar('Active', lang);
    });

    context.subscriptions.push(disposable);

    let toggleDisposable = vscode.commands.registerCommand('autolanguage.toggle', () => {
        const settings = vscode.workspace.getConfiguration('autolanguage');
        const currentState = settings.get('enabled');
        settings.update('enabled', !currentState, true);
        // إعادة تعيين آخر سطر تم التبديل فيه
        lastSwitchedLine = -1;
        vscode.window.showInformationMessage(`Auto Language is now ${!currentState ? 'Enabled' : 'Disabled'}`);
    });

    context.subscriptions.push(toggleDisposable);
}

/**
 * كشف بسيط للغة في السطر
 * يتحقق من وجود أحرف عربية أو إنجليزية في السطر
 */
function detectLanguageInLine(document: vscode.TextDocument, line: number): 'Arabic' | 'English' | 'None' {
    const lineText = document.lineAt(line).text;
    if (!lineText || lineText.trim().length === 0) {
        return 'None';
    }

    let arabicCount = 0;
    let englishCount = 0;
    let arabicWordCount = 0;
    let englishWordCount = 0;

    // إحصاء الأحرف
    for (const char of lineText) {
        if (isArabic(char)) {
            arabicCount++;
        } else if (isEnglish(char)) {
            englishCount++;
        }
    }

    // إحصاء الكلمات (لأغراض أفضل)
    const words = lineText.split(/\s+/).filter(word => word.length > 0);
    for (const word of words) {
        if (isArabic(word[0])) {
            arabicWordCount++;
        } else if (isEnglish(word[0])) {
            englishWordCount++;
        }
    }

    // تحديد اللغة بناءً على العدد الأكبر للأحرف والكلمات
    // إعطاء وزن أكبر للكلمات (2x) لأنها أكثر دلالة
    const arabicScore = arabicCount + (arabicWordCount * 2);
    const englishScore = englishCount + (englishWordCount * 2);

    // الحد الأدنى من الأحرف لتحديد اللغة
    const minCharCount = 2;

    if (arabicScore > englishScore && arabicCount >= minCharCount) {
        return 'Arabic';
    } else if (englishScore > arabicScore && englishCount >= minCharCount) {
        return 'English';
    } else {
        return 'None';
    }
}

function isArabic(c: string): boolean {
    const code = c.charCodeAt(0);
    // نطاقات اليونيكود العربية الكاملة
    return (code >= 0x0600 && code <= 0x06FF) ||
        (code >= 0x0750 && code <= 0x077F) ||
        (code >= 0x08A0 && code <= 0x08FF) ||
        (code >= 0xFB50 && code <= 0xFDFF) ||
        (code >= 0xFE70 && code <= 0xFEFF) ||
        (code >= 0x0860 && code <= 0x086F) ||
        (code >= 0x1EE00 && code <= 0x1EEFF);
}

function isEnglish(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
}

async function switchToArabic() {
    if (platform === 'win32') {
        await runPowerShellSwitch('Arabic');
    } else if (platform === 'darwin') {
        await runMacOSSwitch('Arabic');
    } else if (platform === 'linux') {
        await runLinuxSwitch('Arabic');
    } else {
        throw new Error(`Platform ${platform} is not supported.`);
    }
}

async function switchToEnglish() {
    if (platform === 'win32') {
        await runPowerShellSwitch('English');
    } else if (platform === 'darwin') {
        await runMacOSSwitch('English');
    } else if (platform === 'linux') {
        await runLinuxSwitch('English');
    } else {
        throw new Error(`Platform ${platform} is not supported.`);
    }
}

async function runPowerShellSwitch(target: 'Arabic' | 'English') {
    const primaryLangId = target === 'Arabic' ? '0x01' : '0x09';

    // أولاً، حاول الحصول على التخطيط الحالي للتحقق لاحقاً
    let currentLayout = '';
    try {
        const getCurrentLayoutScript = `Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class CurrentLayout {
    [DllImport("user32.dll")]
    public static extern IntPtr GetKeyboardLayout(uint threadId);
}
"@
$layout = [CurrentLayout]::GetKeyboardLayout(0)
$layoutId = ($layout.ToInt64() -band 0xFFFF).ToString("X4")
Write-Output $layoutId`;
        const { stdout } = await execAsync(`powershell -ExecutionPolicy Bypass -Command "${getCurrentLayoutScript}"`);
        currentLayout = stdout.trim();
    } catch (error) {
        // تجاهل الخطأ
    }

    const psScript = `Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public class KeyboardLayout {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetKeyboardLayoutList(int nBuff, [Out] IntPtr[] lpList);

    [DllImport("user32.dll")]
    public static extern IntPtr GetKeyboardLayout(uint threadId);

    public const uint WM_INPUTLANGCHANGEREQUEST = 0x0050;

    public static IntPtr FindLayout(uint targetPrimaryId) {
        IntPtr[] layouts = new IntPtr[16];
        int count = GetKeyboardLayoutList(16, layouts);
        for (int i = 0; i < count; i++) {
            uint langId = (uint)layouts[i].ToInt64() & 0xFFFF;
            uint primaryId = langId & 0x03FF;
            if (primaryId == targetPrimaryId) return layouts[i];
        }
        return IntPtr.Zero;
    }
}
"@
$hwnd = [KeyboardLayout]::GetForegroundWindow()
$layout = [KeyboardLayout]::FindLayout(${primaryLangId})
if ($layout -ne [IntPtr]::Zero) {
    $result = [KeyboardLayout]::PostMessage($hwnd, [KeyboardLayout]::WM_INPUTLANGCHANGEREQUEST, [IntPtr]::Zero, $layout)
    Start-Sleep -Milliseconds 100
    $newLayout = [KeyboardLayout]::GetKeyboardLayout(0)
    $newLayoutId = ($newLayout.ToInt64() -band 0xFFFF).ToString("X4")
    Write-Output $newLayoutId
} else {
    Write-Error "Keyboard layout for ${target} (ID: ${primaryLangId}) not found. Please ensure the keyboard layout is installed."
}`;

    const tempDir = os.tmpdir();
    const tempScriptPath = path.join(tempDir, `autolanguage_switch_${Date.now()}.ps1`);

    try {
        fs.writeFileSync(tempScriptPath, psScript, 'utf8');
        const command = `powershell -ExecutionPolicy Bypass -File "${tempScriptPath}"`;
        const { stdout, stderr } = await execAsync(command);

        if (stderr) {
            if (stderr.includes('not found') || stderr.includes('not installed')) {
                throw new Error(`Keyboard layout for ${target} is not installed on your system.`);
            }
        }

        // تحقق من نجاح التبديل
        if (stdout && stdout.trim()) {
            const newLayout = stdout.trim();
            if (newLayout !== currentLayout) {
                // تم التبديل بنجاح
                return;
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to switch to ${target}: ${errorMessage}`);
    } finally {
        try {
            if (fs.existsSync(tempScriptPath)) {
                fs.unlinkSync(tempScriptPath);
            }
        } catch (cleanupError) {
            // تجاهل خطأ حذف الملف المؤقت
        }
    }

    throw new Error(`Failed to switch to ${target}. Please ensure the keyboard layout is installed.`);
}

async function runMacOSSwitch(target: 'Arabic' | 'English') {
    const arabicLayoutNames = [
        'Arabic',
        'Arabic - PC',
        'Arabic - QWERTY',
        'Arabic-PC',
        'العربية'
    ];

    const englishLayoutNames = [
        'U.S.',
        'US',
        'ABC',
        'British',
        'English',
        'U.S. - International',
        'US International'
    ];

    const layoutNames = target === 'Arabic' ? arabicLayoutNames : englishLayoutNames;

    // أولاً، حاول الحصول على التخطيط الحالي للتحقق لاحقاً
    let currentLayout = '';
    try {
        const { stdout } = await execAsync(`osascript -e 'tell application "System Events" to tell key "input source" of key "text input sources" of key "current" of key "processes" of application "System Events" to get name'`);
        currentLayout = stdout.trim();
    } catch (error) {
        // تجاهل الخطأ
    }

    for (const layoutName of layoutNames) {
        try {
            const script = `tell application "System Events"
                tell process "SystemUIServer"
                    tell menu bar 1
                        tell menu bar item "Input Sources"
                            tell menu 1
                                click menu item "${layoutName}"
                            end tell
                        end tell
                    end tell
                end tell
            end tell`;

            const command = `osascript -e '${script}'`;
            await execAsync(command);
            await sleep(100);

            // تحقق من نجاح التبديل
            try {
                const { stdout: newLayout } = await execAsync(`osascript -e 'tell application "System Events" to tell key "input source" of key "text input sources" of key "current" of key "processes" of application "System Events" to get name'`);
                if (newLayout.trim() !== currentLayout) {
                    // تم التبديل بنجاح
                    return;
                }
            } catch (error) {
                // تجاهل الخطأ في التحقق
            }
        } catch (error) {
            continue;
        }
    }

    // إذا فشلت جميع المحاولات، حاول استخدام Control+Space
    try {
        const command = `osascript -e 'tell application "System Events" to keystroke space using {control down}'`;
        await execAsync(command);
        await sleep(300);

        // تحقق من نجاح التبديل
        try {
            const { stdout: newLayout } = await execAsync(`osascript -e 'tell application "System Events" to tell key "input source" of key "text input sources" of key "current" of key "processes" of application "System Events" to get name'`);
            if (newLayout.trim() !== currentLayout) {
                // تم التبديل بنجاح
                return;
            }
        } catch (error) {
            // تجاهل الخطأ في التحقق
        }
    } catch (error) {
        throw new Error(`Failed to switch to ${target} on macOS. Please ensure keyboard layouts are installed in System Preferences.`);
    }

    throw new Error(`Failed to switch to ${target} on macOS. Please ensure keyboard layouts are installed in System Preferences.`);
}

async function runLinuxSwitch(target: 'Arabic' | 'English') {
    try {
        const { stdout: layouts } = await execAsync('gsettings get org.gnome.desktop.input-sources sources');

        const arabicLayouts = ['ar', 'ara', 'arabic'];
        const englishLayouts = ['us', 'en', 'eng', 'english', 'gb'];

        const targetLayouts = target === 'Arabic' ? arabicLayouts : englishLayouts;

        const layoutArray = JSON.parse(layouts.replace(/'/g, '"'));
        let targetIndex = -1;

        for (let i = 0; i < layoutArray.length; i++) {
            const layout = layoutArray[i][1];
            if (targetLayouts.some(t => layout.includes(t))) {
                targetIndex = i;
                break;
            }
        }

        if (targetIndex !== -1) {
            await execAsync(`gsettings set org.gnome.desktop.input-sources current ${targetIndex}`);
            await sleep(100);
            return;
        }
    } catch (error) {
        // تجاهل الخطأ والمحاولة بطريقة أخرى
    }

    try {
        const layout = target === 'Arabic' ? 'ar' : 'us';
        await execAsync(`setxkbmap ${layout}`);
        await sleep(100);
        return;
    } catch (error) {
        // تجاهل الخطأ والمحاولة بطريقة أخرى
    }

    try {
        const engine = target === 'Arabic' ? 'xkb:ar::ara' : 'xkb:us::eng';
        await execAsync(`ibus engine ${engine}`);
        await sleep(100);
        return;
    } catch (error) {
        // تجاهل الخطأ
    }

    try {
        const engine = target === 'Arabic' ? 'ar' : 'us';
        await execAsync(`fcitx-remote -s ${engine}`);
        await sleep(100);
        return;
    } catch (error) {
        // تجاهل الخطأ
    }

    try {
        const engine = target === 'Arabic' ? 'ar' : 'us';
        await execAsync(`fcitx5-remote -s ${engine}`);
        await sleep(100);
        return;
    } catch (error) {
        // تجاهل الخطأ
    }

    throw new Error(`Failed to switch to ${target} on Linux. Please ensure keyboard layouts are installed and try installing gsettings, setxkbmap, ibus, fcitx, or fcitx5.`);
}

function updateStatusBar(status: string, lang: string) {
    const settings = vscode.workspace.getConfiguration('autolanguage');
    if (!settings.get('showStatusBar')) {
        statusBarItem.hide();
        return;
    }

    let icon: string;
    if (lang === 'Arabic') {
        icon = '$(symbol-namespace)';
    } else if (lang === 'English') {
        icon = '$(symbol-enum)';
    } else {
        icon = '$(globe)';
    }

    statusBarItem.text = `${icon} AutoLang: ${lang === 'None' ? '...' : lang}`;
    statusBarItem.tooltip = `Status: ${status}\nLanguage: ${lang}`;
    statusBarItem.show();
}

export function deactivate() { }
