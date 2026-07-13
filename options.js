const form = document.querySelector("#settings-form");
const uiLanguage = document.querySelector("#ui-language");
const transcriptLanguage = document.querySelector("#transcript-language-setting");
const orderList = document.querySelector("#capture-order");
const modes = document.querySelector("#toolbar-modes");
const themes = document.querySelector("#toolbar-themes");
const resetButton = document.querySelector("#reset-settings");
const saveStatus = document.querySelector("#save-status");
const promptSearch = document.querySelector("#prompt-search");
const promptLibraryList = document.querySelector("#prompt-library");
const promptLibraryEmpty = document.querySelector("#prompt-library-empty");
const promptCount = document.querySelector("#prompt-count");
const createPromptButton = document.querySelector("#create-prompt");
const importPromptsButton = document.querySelector("#import-prompts");
const exportPromptsButton = document.querySelector("#export-prompts");
const importPromptsInput = document.querySelector("#import-prompts-input");
const promptEditor = document.querySelector("#prompt-editor");
const promptEditorForm = document.querySelector("#prompt-editor-form");
const promptId = document.querySelector("#prompt-id");
const promptName = document.querySelector("#prompt-name");
const promptText = document.querySelector("#prompt-text");
const promptTags = document.querySelector("#prompt-tags");
const promptEditorError = document.querySelector("#prompt-editor-error");

const COPY = {
  "zh-CN": {
    title: "设置",
    brandTagline: "网页内容与提示词工作台",
    description: "这些设置只保存在这台电脑的 Chrome 中。",
    generalTitle: "语言与字幕",
    generalDescription: "控制插件界面，以及 YouTube/Bilibili 字幕的优先轨道语言。",
    uiLanguage: "插件语言",
    uiLanguageHelp: "设置页和侧边栏界面的显示语言。",
    transcriptLanguage: "首选字幕语言",
    transcriptLanguageHelp: "只决定默认选择哪条轨道；不会翻译或生成字幕。",
    auto: "跟随浏览器语言",
    orderTitle: "功能排列顺序",
    orderDescription: "拖动左侧手柄，或使用上下箭头，决定采集按钮从左到右的顺序。",
    orderAria: "采集功能排列顺序",
    themeTitle: "顶部栏外观",
    themeDescription: "明暗模式作用于 Atlas Sidebar，并传递给支持系统主题的网站；主题风格装饰顶部栏。",
    themeModeTitle: "明暗模式",
    themeModeDescription: "跟随系统时，仍使用下方所选主题的 Light/Dark 配色。",
    themeModeLegend: "顶部栏明暗模式",
    themeStyleTitle: "主题风格",
    themeStyleDescription: "每款主题都包含对应的 Light 和 Dark 调色板。",
    themeLegend: "顶部栏主题风格",
    reset: "恢复默认",
    save: "保存设置",
    saved: "设置已保存，并会同步到已打开的侧边栏。",
    defaults: "已恢复默认值；点击“保存设置”后生效。",
    up: "上移",
    down: "下移",
    drag: "拖动排序",
    features: { link: "链接", screenshot: "截图", document: "文档", "local-file": "本地文件", prompt: "提示词", transcript: "字幕" },
    modeNames: { system: "跟随系统", light: "浅色", dark: "深色" },
    themeNames: { classic: "经典", ocean: "海洋", graphite: "石墨" },
    promptsTitle: "常用提示词",
    promptsDescription: "保存经常使用的提示词，需要时从侧边栏加入临时素材。",
    createPrompt: "新建提示词",
    searchPrompts: "搜索提示词",
    searchPlaceholder: "搜索名称、正文或标签",
    savedPrompts: "已保存的提示词",
    emptyPrompts: "还没有保存提示词。",
    promptCount: (count) => `${count} 个提示词`,
    importPrompts: "导入 JSON",
    exportPrompts: "导出 JSON",
    editPrompt: "编辑",
    deletePrompt: "删除",
    newPromptTitle: "新建提示词",
    editPromptTitle: "编辑提示词",
    promptEditorDescription: "使用 {变量} 创建可选字段；留空会保留占位符，稍后可在 ChatGPT 输入区填写。",
    promptName: "名称",
    promptNamePlaceholder: "给提示词起一个名字",
    promptText: "提示词",
    promptTextHelp: "例如：请为 {audience} 总结这篇论文。",
    promptTags: "标签（可选）",
    promptTagsPlaceholder: "研究, 写作, 代码",
    cancel: "取消",
    savePrompt: "保存提示词",
    close: "关闭",
    promptSaved: "提示词已保存。",
    promptDeleted: "提示词已删除。",
    confirmDelete: (name) => `确定删除“${name}”吗？`,
    exported: "提示词库已导出到本地。",
    imported: (count) => `已导入 ${count} 个提示词；现有提示词没有被清空。`
  },
  en: {
    title: "Settings",
    brandTagline: "Page content and prompt workspace",
    description: "These settings are stored only in Chrome on this computer.",
    generalTitle: "Language and transcripts",
    generalDescription: "Control the extension interface and preferred YouTube/Bilibili transcript language.",
    uiLanguage: "Extension language",
    uiLanguageHelp: "Language used by the settings page and sidebar interface.",
    transcriptLanguage: "Preferred transcript language",
    transcriptLanguageHelp: "Chooses the default track only; it does not translate or generate transcripts.",
    auto: "Follow browser language",
    orderTitle: "Feature order",
    orderDescription: "Drag the left handle or use the arrows to order capture actions.",
    orderAria: "Capture feature order",
    themeTitle: "Toolbar appearance",
    themeDescription: "Brightness themes Atlas Sidebar and is passed to websites that support system themes; style decorates the toolbar.",
    themeModeTitle: "Brightness",
    themeModeDescription: "System mode still uses the selected theme’s paired Light/Dark palettes.",
    themeModeLegend: "Toolbar brightness mode",
    themeStyleTitle: "Theme style",
    themeStyleDescription: "Every style includes a matching Light and Dark palette.",
    themeLegend: "Toolbar theme style",
    reset: "Restore defaults",
    save: "Save settings",
    saved: "Settings saved and synced to open sidebars.",
    defaults: "Defaults restored. Choose “Save settings” to apply them.",
    up: "Move up",
    down: "Move down",
    drag: "Drag to reorder",
    features: { link: "Link", screenshot: "Screenshot", document: "Document", "local-file": "Local file", prompt: "Prompt", transcript: "Transcript" },
    modeNames: { system: "System", light: "Light", dark: "Dark" },
    themeNames: { classic: "Classic", ocean: "Ocean", graphite: "Graphite" },
    promptsTitle: "Saved prompts",
    promptsDescription: "Save prompts you reuse and add them to temporary materials from the sidebar.",
    createPrompt: "Create prompt",
    searchPrompts: "Search prompts",
    searchPlaceholder: "Search names, text, or tags",
    savedPrompts: "Saved prompts",
    emptyPrompts: "No saved prompts yet.",
    promptCount: (count) => `${count} prompts`,
    importPrompts: "Import JSON",
    exportPrompts: "Export JSON",
    editPrompt: "Edit",
    deletePrompt: "Delete",
    newPromptTitle: "Create prompt",
    editPromptTitle: "Edit prompt",
    promptEditorDescription: "Use {variables} for optional fields. Blank values stay as placeholders you can fill in ChatGPT.",
    promptName: "Name",
    promptNamePlaceholder: "Name your prompt",
    promptText: "Prompt",
    promptTextHelp: "Example: Summarize this paper for {audience}.",
    promptTags: "Tags (optional)",
    promptTagsPlaceholder: "research, writing, code",
    cancel: "Cancel",
    savePrompt: "Save prompt",
    close: "Close",
    promptSaved: "Prompt saved.",
    promptDeleted: "Prompt deleted.",
    confirmDelete: (name) => `Delete “${name}”?`,
    exported: "Prompt library exported locally.",
    imported: (count) => `Imported ${count} prompts without clearing your existing library.`
  }
};

function localizedCopy(overrides) {
  return { ...COPY.en, ...overrides };
}

Object.assign(COPY, {
  es: localizedCopy({
    title: "Configuración", brandTagline: "Espacio de trabajo para contenido web y prompts", description: "Esta configuración se guarda solo en Chrome en este ordenador.",
    generalTitle: "Idioma y subtítulos", generalDescription: "Controla la interfaz y el idioma preferido de los subtítulos de YouTube/Bilibili.",
    uiLanguage: "Idioma de la extensión", uiLanguageHelp: "Idioma de la página de configuración y la barra lateral.",
    transcriptLanguage: "Idioma preferido de subtítulos", transcriptLanguageHelp: "Elige primero una pista coincidente; si no existe, usa otra disponible.",
    auto: "Seguir el idioma del navegador", orderTitle: "Orden de funciones",
    orderDescription: "Arrastra el control izquierdo o usa las flechas para ordenar las acciones de captura.", orderAria: "Orden de funciones de captura",
    themeTitle: "Apariencia de la barra", themeDescription: "El brillo afecta a Atlas Sidebar y a sitios que siguen el tema del sistema; el estilo decora la barra.",
    themeModeTitle: "Brillo", themeModeDescription: "El modo del sistema usa las variantes Light/Dark del tema elegido.", themeModeLegend: "Modo de brillo",
    themeStyleTitle: "Estilo del tema", themeStyleDescription: "Cada estilo incluye paletas Light y Dark.", themeLegend: "Estilo de la barra",
    reset: "Restaurar valores", save: "Guardar configuración", saved: "Configuración guardada y sincronizada con las barras abiertas.",
    defaults: "Valores restaurados. Pulsa «Guardar configuración» para aplicarlos.", up: "Subir", down: "Bajar", drag: "Arrastrar para ordenar",
    features: { link: "Enlace", screenshot: "Captura", document: "Documento", "local-file": "Archivo local", prompt: "Prompt", transcript: "Subtítulos" },
    modeNames: { system: "Sistema", light: "Claro", dark: "Oscuro" }, themeNames: { classic: "Clásico", ocean: "Océano", graphite: "Grafito" },
    promptsTitle: "Prompts guardados", promptsDescription: "Guarda prompts frecuentes y añádelos a los materiales desde la barra lateral.",
    createPrompt: "Crear prompt", searchPrompts: "Buscar prompts", searchPlaceholder: "Buscar por nombre, texto o etiqueta",
    savedPrompts: "Prompts guardados", emptyPrompts: "Todavía no hay prompts guardados.", promptCount: (count) => `${count} prompts`,
    importPrompts: "Importar JSON", exportPrompts: "Exportar JSON", editPrompt: "Editar", deletePrompt: "Eliminar",
    newPromptTitle: "Crear prompt", editPromptTitle: "Editar prompt", promptEditorDescription: "Usa {variables} para campos opcionales. Si quedan vacíos, se conservan para completarlos en ChatGPT.",
    promptName: "Nombre", promptNamePlaceholder: "Pon un nombre al prompt", promptText: "Prompt",
    promptTextHelp: "Ejemplo: Resume este artículo para {audiencia}.", promptTags: "Etiquetas (opcional)", promptTagsPlaceholder: "investigación, escritura, código",
    cancel: "Cancelar", savePrompt: "Guardar prompt", close: "Cerrar", promptSaved: "Prompt guardado.", promptDeleted: "Prompt eliminado.",
    confirmDelete: (name) => `¿Eliminar «${name}»?`, exported: "Biblioteca de prompts exportada.",
    imported: (count) => `Se importaron ${count} prompts sin borrar los existentes.`
  }),
  fr: localizedCopy({
    title: "Paramètres", brandTagline: "Espace de travail pour contenus web et prompts", description: "Ces paramètres sont enregistrés uniquement dans Chrome sur cet ordinateur.",
    generalTitle: "Langue et sous-titres", generalDescription: "Contrôlez l’interface et la langue de sous-titres YouTube/Bilibili préférée.",
    uiLanguage: "Langue de l’extension", uiLanguageHelp: "Langue de la page de paramètres et de la barre latérale.",
    transcriptLanguage: "Langue de sous-titres préférée", transcriptLanguageHelp: "Privilégie une piste correspondante, sinon utilise une autre piste disponible.",
    auto: "Suivre la langue du navigateur", orderTitle: "Ordre des fonctions",
    orderDescription: "Faites glisser la poignée gauche ou utilisez les flèches pour ordonner les actions.", orderAria: "Ordre des fonctions de capture",
    themeTitle: "Apparence de la barre", themeDescription: "La luminosité affecte Atlas Sidebar et les sites suivant le thème système ; le style décore la barre.",
    themeModeTitle: "Luminosité", themeModeDescription: "Le mode système utilise les variantes Light/Dark du thème choisi.", themeModeLegend: "Mode de luminosité",
    themeStyleTitle: "Style du thème", themeStyleDescription: "Chaque style comprend une palette Light et Dark.", themeLegend: "Style de la barre",
    reset: "Rétablir les valeurs", save: "Enregistrer", saved: "Paramètres enregistrés et synchronisés avec les barres ouvertes.",
    defaults: "Valeurs rétablies. Cliquez sur « Enregistrer » pour les appliquer.", up: "Monter", down: "Descendre", drag: "Faire glisser pour réordonner",
    features: { link: "Lien", screenshot: "Capture", document: "Document", "local-file": "Fichier local", prompt: "Prompt", transcript: "Sous-titres" },
    modeNames: { system: "Système", light: "Clair", dark: "Sombre" }, themeNames: { classic: "Classique", ocean: "Océan", graphite: "Graphite" },
    promptsTitle: "Prompts enregistrés", promptsDescription: "Enregistrez vos prompts fréquents et ajoutez-les aux éléments depuis la barre latérale.",
    createPrompt: "Créer un prompt", searchPrompts: "Rechercher", searchPlaceholder: "Rechercher un nom, un texte ou une étiquette",
    savedPrompts: "Prompts enregistrés", emptyPrompts: "Aucun prompt enregistré.", promptCount: (count) => `${count} prompts`,
    importPrompts: "Importer JSON", exportPrompts: "Exporter JSON", editPrompt: "Modifier", deletePrompt: "Supprimer",
    newPromptTitle: "Créer un prompt", editPromptTitle: "Modifier le prompt", promptEditorDescription: "Utilisez {variables} pour des champs facultatifs. Les valeurs vides restent à compléter dans ChatGPT.",
    promptName: "Nom", promptNamePlaceholder: "Nommez votre prompt", promptText: "Prompt",
    promptTextHelp: "Exemple : Résumez cet article pour {public}.", promptTags: "Étiquettes (facultatif)", promptTagsPlaceholder: "recherche, rédaction, code",
    cancel: "Annuler", savePrompt: "Enregistrer", close: "Fermer", promptSaved: "Prompt enregistré.", promptDeleted: "Prompt supprimé.",
    confirmDelete: (name) => `Supprimer « ${name} » ?`, exported: "Bibliothèque de prompts exportée.",
    imported: (count) => `${count} prompts importés sans effacer la bibliothèque existante.`
  }),
  de: localizedCopy({
    title: "Einstellungen", brandTagline: "Arbeitsbereich für Webinhalte und Prompts", description: "Diese Einstellungen werden nur in Chrome auf diesem Computer gespeichert.",
    generalTitle: "Sprache und Untertitel", generalDescription: "Steuert die Oberfläche und die bevorzugte YouTube/Bilibili-Untertitelsprache.",
    uiLanguage: "Erweiterungssprache", uiLanguageHelp: "Sprache der Einstellungsseite und der Seitenleiste.",
    transcriptLanguage: "Bevorzugte Untertitelsprache", transcriptLanguageHelp: "Bevorzugt eine passende Spur; andernfalls wird eine andere verfügbare verwendet.",
    auto: "Browsersprache verwenden", orderTitle: "Funktionsreihenfolge",
    orderDescription: "Am linken Griff ziehen oder die Pfeile verwenden, um die Aktionen zu sortieren.", orderAria: "Reihenfolge der Erfassungsfunktionen",
    themeTitle: "Darstellung der Symbolleiste", themeDescription: "Die Helligkeit gilt für Atlas Sidebar und Websites mit Systemthema; der Stil gestaltet die Leiste.",
    themeModeTitle: "Helligkeit", themeModeDescription: "Der Systemmodus nutzt die Light/Dark-Varianten des gewählten Stils.", themeModeLegend: "Helligkeitsmodus",
    themeStyleTitle: "Themenstil", themeStyleDescription: "Jeder Stil enthält eine passende Light- und Dark-Palette.", themeLegend: "Themenstil der Symbolleiste",
    reset: "Standard wiederherstellen", save: "Einstellungen speichern", saved: "Einstellungen gespeichert und mit offenen Seitenleisten synchronisiert.",
    defaults: "Standardwerte wiederhergestellt. Zum Anwenden speichern.", up: "Nach oben", down: "Nach unten", drag: "Zum Sortieren ziehen",
    features: { link: "Link", screenshot: "Screenshot", document: "Dokument", "local-file": "Lokale Datei", prompt: "Prompt", transcript: "Untertitel" },
    modeNames: { system: "System", light: "Hell", dark: "Dunkel" }, themeNames: { classic: "Klassisch", ocean: "Ozean", graphite: "Graphit" },
    promptsTitle: "Gespeicherte Prompts", promptsDescription: "Häufige Prompts speichern und über die Seitenleiste zu den Materialien hinzufügen.",
    createPrompt: "Prompt erstellen", searchPrompts: "Prompts suchen", searchPlaceholder: "Name, Text oder Tags durchsuchen",
    savedPrompts: "Gespeicherte Prompts", emptyPrompts: "Noch keine Prompts gespeichert.", promptCount: (count) => `${count} Prompts`,
    importPrompts: "JSON importieren", exportPrompts: "JSON exportieren", editPrompt: "Bearbeiten", deletePrompt: "Löschen",
    newPromptTitle: "Prompt erstellen", editPromptTitle: "Prompt bearbeiten", promptEditorDescription: "Mit {Variablen} optionale Felder erstellen. Leere Werte bleiben als Platzhalter für ChatGPT erhalten.",
    promptName: "Name", promptNamePlaceholder: "Prompt benennen", promptText: "Prompt",
    promptTextHelp: "Beispiel: Fasse diesen Artikel für {Zielgruppe} zusammen.", promptTags: "Tags (optional)", promptTagsPlaceholder: "Forschung, Schreiben, Code",
    cancel: "Abbrechen", savePrompt: "Prompt speichern", close: "Schließen", promptSaved: "Prompt gespeichert.", promptDeleted: "Prompt gelöscht.",
    confirmDelete: (name) => `„${name}“ löschen?`, exported: "Prompt-Bibliothek exportiert.",
    imported: (count) => `${count} Prompts importiert, vorhandene Prompts wurden beibehalten.`
  }),
  ja: localizedCopy({
    title: "設定", brandTagline: "Web コンテンツとプロンプトのワークスペース", description: "設定はこのパソコンの Chrome 内にのみ保存されます。",
    generalTitle: "言語と字幕", generalDescription: "拡張機能の表示言語と YouTube/Bilibili 字幕の優先言語を設定します。",
    uiLanguage: "拡張機能の言語", uiLanguageHelp: "設定ページとサイドバーに表示する言語です。",
    transcriptLanguage: "優先する字幕言語", transcriptLanguageHelp: "一致する字幕を優先し、ない場合は利用可能な別の字幕を使います。",
    auto: "ブラウザーの言語に従う", orderTitle: "機能の並び順",
    orderDescription: "左のハンドルをドラッグするか、矢印で収集ボタンを並べ替えます。", orderAria: "収集機能の並び順",
    themeTitle: "トップバーの外観", themeDescription: "明暗モードは Atlas Sidebar とシステムテーマ対応サイトに伝わり、テーマはバーを装飾します。",
    themeModeTitle: "明暗モード", themeModeDescription: "システム設定では、選択テーマの Light/Dark 配色を切り替えます。", themeModeLegend: "トップバーの明暗モード",
    themeStyleTitle: "テーマ", themeStyleDescription: "各テーマに対応する Light と Dark の配色があります。", themeLegend: "トップバーのテーマ",
    reset: "初期設定に戻す", save: "設定を保存", saved: "設定を保存し、開いているサイドバーに反映しました。",
    defaults: "初期値に戻しました。「設定を保存」で適用されます。", up: "上へ", down: "下へ", drag: "ドラッグして並べ替え",
    features: { link: "リンク", screenshot: "スクリーンショット", document: "文書", "local-file": "ローカルファイル", prompt: "プロンプト", transcript: "字幕" },
    modeNames: { system: "システム", light: "ライト", dark: "ダーク" }, themeNames: { classic: "クラシック", ocean: "オーシャン", graphite: "グラファイト" },
    promptsTitle: "保存済みプロンプト", promptsDescription: "よく使うプロンプトを保存し、サイドバーから一時素材に追加できます。",
    createPrompt: "プロンプトを作成", searchPrompts: "プロンプトを検索", searchPlaceholder: "名前、本文、タグを検索",
    savedPrompts: "保存済みプロンプト", emptyPrompts: "保存済みプロンプトはありません。", promptCount: (count) => `${count} 件のプロンプト`,
    importPrompts: "JSON を読み込む", exportPrompts: "JSON を書き出す", editPrompt: "編集", deletePrompt: "削除",
    newPromptTitle: "プロンプトを作成", editPromptTitle: "プロンプトを編集", promptEditorDescription: "{変数} は任意です。空欄のままならプレースホルダーを ChatGPT で入力できます。",
    promptName: "名前", promptNamePlaceholder: "プロンプト名", promptText: "プロンプト",
    promptTextHelp: "例：この論文を {対象読者} 向けに要約してください。", promptTags: "タグ（任意）", promptTagsPlaceholder: "研究, 執筆, コード",
    cancel: "キャンセル", savePrompt: "プロンプトを保存", close: "閉じる", promptSaved: "プロンプトを保存しました。", promptDeleted: "プロンプトを削除しました。",
    confirmDelete: (name) => `「${name}」を削除しますか？`, exported: "プロンプトライブラリを書き出しました。",
    imported: (count) => `既存のプロンプトを残したまま ${count} 件を読み込みました。`
  }),
  ko: localizedCopy({
    title: "설정", brandTagline: "웹 콘텐츠와 프롬프트 작업 공간", description: "이 설정은 이 컴퓨터의 Chrome에만 저장됩니다.",
    generalTitle: "언어 및 자막", generalDescription: "확장 프로그램 화면과 YouTube/Bilibili 자막의 선호 언어를 설정합니다.",
    uiLanguage: "확장 프로그램 언어", uiLanguageHelp: "설정 페이지와 사이드바에 표시할 언어입니다.",
    transcriptLanguage: "선호 자막 언어", transcriptLanguageHelp: "일치하는 트랙을 우선하고, 없으면 다른 사용 가능한 자막을 사용합니다.",
    auto: "브라우저 언어 따르기", orderTitle: "기능 순서",
    orderDescription: "왼쪽 핸들을 끌거나 화살표를 사용해 수집 기능 순서를 바꿉니다.", orderAria: "수집 기능 순서",
    themeTitle: "상단 바 모양", themeDescription: "밝기 모드는 Atlas Sidebar와 시스템 테마 지원 사이트에 전달되며, 테마는 상단 바를 꾸밉니다.",
    themeModeTitle: "밝기 모드", themeModeDescription: "시스템 모드는 선택한 테마의 Light/Dark 색상을 전환합니다.", themeModeLegend: "상단 바 밝기 모드",
    themeStyleTitle: "테마 스타일", themeStyleDescription: "각 테마에는 Light와 Dark 팔레트가 모두 있습니다.", themeLegend: "상단 바 테마 스타일",
    reset: "기본값 복원", save: "설정 저장", saved: "설정을 저장하고 열린 사이드바에 반영했습니다.",
    defaults: "기본값으로 복원했습니다. 적용하려면 설정을 저장하세요.", up: "위로", down: "아래로", drag: "끌어서 순서 변경",
    features: { link: "링크", screenshot: "스크린샷", document: "문서", "local-file": "로컬 파일", prompt: "프롬프트", transcript: "자막" },
    modeNames: { system: "시스템", light: "라이트", dark: "다크" }, themeNames: { classic: "클래식", ocean: "오션", graphite: "그래파이트" },
    promptsTitle: "저장된 프롬프트", promptsDescription: "자주 쓰는 프롬프트를 저장하고 사이드바에서 임시 자료에 추가합니다.",
    createPrompt: "프롬프트 만들기", searchPrompts: "프롬프트 검색", searchPlaceholder: "이름, 본문 또는 태그 검색",
    savedPrompts: "저장된 프롬프트", emptyPrompts: "저장된 프롬프트가 없습니다.", promptCount: (count) => `프롬프트 ${count}개`,
    importPrompts: "JSON 가져오기", exportPrompts: "JSON 내보내기", editPrompt: "편집", deletePrompt: "삭제",
    newPromptTitle: "프롬프트 만들기", editPromptTitle: "프롬프트 편집", promptEditorDescription: "{변수}는 선택 사항입니다. 비워 두면 ChatGPT에서 채울 자리표시자가 유지됩니다.",
    promptName: "이름", promptNamePlaceholder: "프롬프트 이름", promptText: "프롬프트",
    promptTextHelp: "예: 이 논문을 {대상}에게 맞게 요약해 주세요.", promptTags: "태그(선택)", promptTagsPlaceholder: "연구, 글쓰기, 코드",
    cancel: "취소", savePrompt: "프롬프트 저장", close: "닫기", promptSaved: "프롬프트를 저장했습니다.", promptDeleted: "프롬프트를 삭제했습니다.",
    confirmDelete: (name) => `“${name}”을 삭제할까요?`, exported: "프롬프트 라이브러리를 내보냈습니다.",
    imported: (count) => `기존 항목을 유지하고 프롬프트 ${count}개를 가져왔습니다.`
  }),
  "pt-BR": localizedCopy({
    title: "Configurações", brandTagline: "Espaço de trabalho para conteúdo web e prompts", description: "Estas configurações ficam salvas apenas no Chrome deste computador.",
    generalTitle: "Idioma e legendas", generalDescription: "Controla a interface e o idioma preferido das legendas do YouTube/Bilibili.",
    uiLanguage: "Idioma da extensão", uiLanguageHelp: "Idioma usado na página de configurações e na barra lateral.",
    transcriptLanguage: "Idioma preferido das legendas", transcriptLanguageHelp: "Prioriza uma faixa correspondente; se não houver, usa outra disponível.",
    auto: "Seguir idioma do navegador", orderTitle: "Ordem das funções",
    orderDescription: "Arraste a alça à esquerda ou use as setas para ordenar as ações de captura.", orderAria: "Ordem das funções de captura",
    themeTitle: "Aparência da barra", themeDescription: "O brilho afeta o Atlas Sidebar e sites que seguem o tema do sistema; o estilo decora a barra.",
    themeModeTitle: "Brilho", themeModeDescription: "O modo do sistema usa as variantes Light/Dark do tema escolhido.", themeModeLegend: "Modo de brilho",
    themeStyleTitle: "Estilo do tema", themeStyleDescription: "Cada estilo inclui paletas Light e Dark.", themeLegend: "Estilo da barra",
    reset: "Restaurar padrões", save: "Salvar configurações", saved: "Configurações salvas e sincronizadas com as barras abertas.",
    defaults: "Padrões restaurados. Clique em “Salvar configurações” para aplicar.", up: "Mover para cima", down: "Mover para baixo", drag: "Arrastar para reordenar",
    features: { link: "Link", screenshot: "Captura", document: "Documento", "local-file": "Arquivo local", prompt: "Prompt", transcript: "Legendas" },
    modeNames: { system: "Sistema", light: "Claro", dark: "Escuro" }, themeNames: { classic: "Clássico", ocean: "Oceano", graphite: "Grafite" },
    promptsTitle: "Prompts salvos", promptsDescription: "Salve prompts frequentes e adicione-os aos materiais pela barra lateral.",
    createPrompt: "Criar prompt", searchPrompts: "Pesquisar prompts", searchPlaceholder: "Pesquisar nome, texto ou tags",
    savedPrompts: "Prompts salvos", emptyPrompts: "Ainda não há prompts salvos.", promptCount: (count) => `${count} prompts`,
    importPrompts: "Importar JSON", exportPrompts: "Exportar JSON", editPrompt: "Editar", deletePrompt: "Excluir",
    newPromptTitle: "Criar prompt", editPromptTitle: "Editar prompt", promptEditorDescription: "Use {variáveis} em campos opcionais. Valores vazios ficam como marcadores para preencher no ChatGPT.",
    promptName: "Nome", promptNamePlaceholder: "Dê um nome ao prompt", promptText: "Prompt",
    promptTextHelp: "Exemplo: Resuma este artigo para {público}.", promptTags: "Tags (opcional)", promptTagsPlaceholder: "pesquisa, escrita, código",
    cancel: "Cancelar", savePrompt: "Salvar prompt", close: "Fechar", promptSaved: "Prompt salvo.", promptDeleted: "Prompt excluído.",
    confirmDelete: (name) => `Excluir “${name}”?`, exported: "Biblioteca de prompts exportada.",
    imported: (count) => `${count} prompts importados sem apagar a biblioteca existente.`
  })
});

let captureOrder = [...AtlasSettings.DEFAULTS.captureOrder];
let currentLanguage = AtlasSettings.DEFAULTS.uiLanguage;
let promptLibrary = AtlasPrompts.normalizeLibrary();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await AtlasSettings.save(readForm());
  saveStatus.textContent = COPY[currentLanguage].saved;
});
uiLanguage.addEventListener("change", () => applyLanguage(uiLanguage.value));
resetButton.addEventListener("click", () => {
  populate(AtlasSettings.DEFAULTS);
  saveStatus.textContent = COPY[currentLanguage].defaults;
});
promptSearch.addEventListener("input", renderPromptLibrary);
createPromptButton.addEventListener("click", () => openPromptEditor());
document.querySelector("#close-prompt-editor").addEventListener("click", closePromptEditor);
document.querySelector("#cancel-prompt-editor").addEventListener("click", closePromptEditor);
promptEditor.addEventListener("cancel", (event) => {
  event.preventDefault();
  closePromptEditor();
});
promptEditorForm.addEventListener("submit", (event) => void savePromptFromEditor(event));
importPromptsButton.addEventListener("click", () => importPromptsInput.click());
importPromptsInput.addEventListener("change", () => void importPromptFile());
exportPromptsButton.addEventListener("click", exportPromptLibrary);
globalThis.chrome?.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[AtlasPrompts.STORAGE_KEY]) return;
  promptLibrary = AtlasPrompts.normalizeLibrary(
    changes[AtlasPrompts.STORAGE_KEY].newValue
  );
  renderPromptLibrary();
});

void initialize();

async function initialize() {
  const [settings, prompts] = await Promise.all([
    AtlasSettings.load(),
    AtlasPrompts.load()
  ]);
  promptLibrary = prompts;
  populate(settings);
  renderPromptLibrary();
}

function populate(settings) {
  const normalized = AtlasSettings.normalize(settings);
  uiLanguage.value = normalized.uiLanguage;
  transcriptLanguage.value = normalized.transcriptLanguage;
  captureOrder = [...normalized.captureOrder];
  renderModes(normalized.toolbarMode);
  renderThemes(normalized.toolbarTheme);
  updateThemePreviewMode(normalized.toolbarMode);
  applyLanguage(normalized.uiLanguage);
}

function readForm() {
  return AtlasSettings.normalize({
    uiLanguage: uiLanguage.value,
    transcriptLanguage: transcriptLanguage.value,
    captureOrder,
    toolbarMode: modes.querySelector('input[name="toolbarMode"]:checked')?.value,
    toolbarTheme: themes.querySelector('input[name="toolbarTheme"]:checked')?.value
  });
}

function applyLanguage(language) {
  currentLanguage = AtlasSettings.UI_LANGUAGES.includes(language)
    ? language
    : AtlasSettings.DEFAULTS.uiLanguage;
  const copy = COPY[currentLanguage];
  document.documentElement.lang = currentLanguage;
  document.title = `Atlas Sidebar · ${copy.title}`;
  setText("brand-tagline", copy.brandTagline);
  setText("page-title", copy.title);
  setText("page-description", copy.description);
  setText("general-title", copy.generalTitle);
  setText("general-description", copy.generalDescription);
  setText("ui-language-label", copy.uiLanguage);
  setText("ui-language-help", copy.uiLanguageHelp);
  setText("transcript-language-label", copy.transcriptLanguage);
  setText("transcript-language-help", copy.transcriptLanguageHelp);
  transcriptLanguage.options[0].textContent = copy.auto;
  setText("order-title", copy.orderTitle);
  setText("order-description", copy.orderDescription);
  orderList.setAttribute("aria-label", copy.orderAria);
  setText("theme-title", copy.themeTitle);
  setText("theme-description", copy.themeDescription);
  setText("theme-mode-title", copy.themeModeTitle);
  setText("theme-mode-description", copy.themeModeDescription);
  modes.querySelector("legend").textContent = copy.themeModeLegend;
  setText("theme-style-title", copy.themeStyleTitle);
  setText("theme-style-description", copy.themeStyleDescription);
  themes.querySelector("legend").textContent = copy.themeLegend;
  resetButton.textContent = copy.reset;
  document.querySelector("#save-settings").textContent = copy.save;
  setText("prompts-title", copy.promptsTitle);
  setText("prompts-description", copy.promptsDescription);
  createPromptButton.textContent = copy.createPrompt;
  setText("prompt-search-label", copy.searchPrompts);
  promptSearch.placeholder = copy.searchPlaceholder;
  promptLibraryList.setAttribute("aria-label", copy.savedPrompts);
  promptLibraryEmpty.textContent = copy.emptyPrompts;
  importPromptsButton.textContent = copy.importPrompts;
  exportPromptsButton.textContent = copy.exportPrompts;
  setText("prompt-editor-description", copy.promptEditorDescription);
  setText("prompt-name-label", copy.promptName);
  promptName.placeholder = copy.promptNamePlaceholder;
  setText("prompt-text-label", copy.promptText);
  setText("prompt-text-help", copy.promptTextHelp);
  setText("prompt-tags-label", copy.promptTags);
  promptTags.placeholder = copy.promptTagsPlaceholder;
  document.querySelector("#cancel-prompt-editor").textContent = copy.cancel;
  document.querySelector("#save-prompt").textContent = copy.savePrompt;
  document.querySelector("#close-prompt-editor").setAttribute("aria-label", copy.close);
  document.querySelector("#prompt-editor-title").textContent = promptId.value
    ? copy.editPromptTitle
    : copy.newPromptTitle;
  renderOrder();
  refreshThemeLabels();
  renderPromptLibrary();
}

function renderOrder() {
  const copy = COPY[currentLanguage];
  orderList.replaceChildren(...captureOrder.map((feature, index) => {
    const item = document.createElement("li");
    item.className = "order-item";
    item.dataset.feature = feature;
    const handle = document.createElement("span");
    handle.className = "order-handle";
    handle.draggable = true;
    handle.title = `${copy.drag}: ${copy.features[feature]}`;
    handle.setAttribute("aria-hidden", "true");
    handle.addEventListener("dragstart", (event) => startOrderDrag(event, feature));
    handle.addEventListener("dragend", clearOrderDrag);
    handle.textContent = "≡";
    const label = document.createElement("span");
    label.className = "order-label";
    label.textContent = copy.features[feature];
    const up = orderButton("↑", `${copy.up}: ${copy.features[feature]}`, index === 0, () => moveFeature(index, -1));
    const down = orderButton("↓", `${copy.down}: ${copy.features[feature]}`, index === captureOrder.length - 1, () => moveFeature(index, 1));
    item.append(handle, label, up, down);
    item.addEventListener("dragover", (event) => updateOrderDropTarget(event, feature));
    item.addEventListener("dragleave", (event) => {
      if (!item.contains(event.relatedTarget)) clearOrderDropIndicators();
    });
    item.addEventListener("drop", (event) => dropOrderItem(event, feature));
    return item;
  }));
}

let draggedFeature = "";

function startOrderDrag(event, feature) {
  draggedFeature = feature;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", feature);
  event.currentTarget.closest(".order-item")?.classList.add("dragging");
}

function updateOrderDropTarget(event, targetFeature) {
  if (!draggedFeature || draggedFeature === targetFeature) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  clearOrderDropIndicators();
  const item = event.currentTarget;
  const after = event.clientY >= item.getBoundingClientRect().top + item.offsetHeight / 2;
  item.classList.add(after ? "drag-after" : "drag-before");
}

function dropOrderItem(event, targetFeature) {
  if (!draggedFeature || draggedFeature === targetFeature) return clearOrderDrag();
  event.preventDefault();
  const item = event.currentTarget;
  const placement = event.clientY >= item.getBoundingClientRect().top + item.offsetHeight / 2
    ? "after"
    : "before";
  captureOrder = AtlasSettings.reorderFeature(captureOrder, draggedFeature, targetFeature, placement);
  clearOrderDrag();
  renderOrder();
}

function clearOrderDropIndicators() {
  for (const item of orderList.children) item.classList.remove("drag-before", "drag-after");
}

function clearOrderDrag() {
  draggedFeature = "";
  for (const item of orderList.children) item.classList.remove("dragging", "drag-before", "drag-after");
}

function orderButton(text, label, disabled, onClick) {
  const button = document.createElement("button");
  button.className = "order-button";
  button.type = "button";
  button.textContent = text;
  button.disabled = disabled;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

function moveFeature(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= captureOrder.length) return;
  [captureOrder[index], captureOrder[target]] = [captureOrder[target], captureOrder[index]];
  renderOrder();
  orderList.children[target]?.querySelectorAll("button")[delta < 0 ? 0 : 1]?.focus();
}

function renderModes(selected) {
  modes.replaceChildren(modes.querySelector("legend"), ...AtlasSettings.TOOLBAR_MODES.map((mode) => {
    const choice = document.createElement("div");
    choice.className = "mode-choice";
    choice.dataset.mode = mode;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "toolbarMode";
    input.id = `mode-${mode}`;
    input.value = mode;
    input.checked = mode === selected;
    input.addEventListener("change", () => updateThemePreviewMode(mode));
    const label = document.createElement("label");
    label.htmlFor = input.id;
    label.className = "mode-name";
    choice.append(input, label);
    return choice;
  }));
  refreshThemeLabels();
}

function renderThemes(selected) {
  themes.replaceChildren(themes.querySelector("legend"), ...AtlasSettings.TOOLBAR_THEMES.map((theme) => {
    const choice = document.createElement("div");
    choice.className = "theme-choice";
    choice.dataset.theme = theme;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "toolbarTheme";
    input.id = `theme-${theme}`;
    input.value = theme;
    input.checked = theme === selected;
    const label = document.createElement("label");
    label.htmlFor = input.id;
    const preview = document.createElement("span");
    preview.className = "theme-preview";
    preview.setAttribute("aria-hidden", "true");
    const lightPreview = document.createElement("span");
    lightPreview.className = "theme-preview-pane theme-preview-light";
    const darkPreview = document.createElement("span");
    darkPreview.className = "theme-preview-pane theme-preview-dark";
    preview.append(lightPreview, darkPreview);
    const name = document.createElement("span");
    name.className = "theme-name";
    label.append(preview, name);
    choice.append(input, label);
    return choice;
  }));
  refreshThemeLabels();
}

function refreshThemeLabels() {
  const copy = COPY[currentLanguage];
  for (const choice of modes.querySelectorAll(".mode-choice")) {
    choice.querySelector(".mode-name").textContent = copy.modeNames[choice.dataset.mode];
  }
  for (const choice of themes.querySelectorAll(".theme-choice")) {
    choice.querySelector(".theme-name").textContent = copy.themeNames[choice.dataset.theme];
  }
}

function updateThemePreviewMode(mode) {
  themes.dataset.previewMode = AtlasSettings.TOOLBAR_MODES.includes(mode) ? mode : "system";
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function renderPromptLibrary() {
  const copy = COPY[currentLanguage];
  const query = promptSearch.value.trim().toLocaleLowerCase();
  const visible = promptLibrary.prompts.filter((prompt) => {
    const haystack = `${prompt.name}\n${prompt.text}\n${prompt.tags.join(" ")}`.toLocaleLowerCase();
    return !query || haystack.includes(query);
  });
  promptLibraryList.replaceChildren(...visible.map((prompt) => createPromptLibraryItem(prompt, copy)));
  promptLibraryEmpty.hidden = visible.length > 0;
  promptLibraryList.hidden = visible.length === 0;
  promptCount.textContent = copy.promptCount(promptLibrary.prompts.length);
  exportPromptsButton.disabled = promptLibrary.prompts.length === 0;
}

function createPromptLibraryItem(prompt, copy) {
  const item = document.createElement("li");
  item.className = "prompt-library-item";
  const body = document.createElement("div");
  body.className = "prompt-library-copy";
  const name = document.createElement("h3");
  name.className = "prompt-library-name";
  name.textContent = prompt.name;
  const preview = document.createElement("p");
  preview.className = "prompt-library-preview";
  preview.textContent = prompt.text;
  body.append(name, preview);
  if (prompt.tags.length) {
    const tags = document.createElement("div");
    tags.className = "prompt-tags";
    for (const value of prompt.tags) {
      const tag = document.createElement("span");
      tag.className = "prompt-tag";
      tag.textContent = value;
      tags.append(tag);
    }
    body.append(tags);
  }
  const actions = document.createElement("div");
  actions.className = "prompt-library-actions";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "✎";
  edit.title = copy.editPrompt;
  edit.setAttribute("aria-label", `${copy.editPrompt}: ${prompt.name}`);
  edit.addEventListener("click", () => openPromptEditor(prompt));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "×";
  remove.title = copy.deletePrompt;
  remove.setAttribute("aria-label", `${copy.deletePrompt}: ${prompt.name}`);
  remove.addEventListener("click", () => void deletePrompt(prompt));
  actions.append(edit, remove);
  item.append(body, actions);
  return item;
}

function openPromptEditor(prompt = null) {
  const copy = COPY[currentLanguage];
  promptId.value = prompt?.id || "";
  promptName.value = prompt?.name || "";
  promptText.value = prompt?.text || "";
  promptTags.value = prompt?.tags?.join(", ") || "";
  promptEditorError.textContent = "";
  document.querySelector("#prompt-editor-title").textContent = prompt
    ? copy.editPromptTitle
    : copy.newPromptTitle;
  promptEditor.showModal();
  requestAnimationFrame(() => promptName.focus());
}

function closePromptEditor() {
  if (promptEditor.open) promptEditor.close();
}

async function savePromptFromEditor(event) {
  event.preventDefault();
  promptEditorError.textContent = "";
  try {
    const existing = promptLibrary.prompts.find((prompt) => prompt.id === promptId.value);
    promptLibrary = AtlasPrompts.upsert(promptLibrary, {
      id: promptId.value || undefined,
      name: promptName.value,
      text: promptText.value,
      tags: promptTags.value,
      createdAt: existing?.createdAt
    });
    promptLibrary = await AtlasPrompts.save(promptLibrary);
    closePromptEditor();
    renderPromptLibrary();
    saveStatus.textContent = COPY[currentLanguage].promptSaved;
  } catch (error) {
    promptEditorError.textContent = AtlasPrompts.formatError(error, currentLanguage);
  }
}

async function deletePrompt(prompt) {
  const copy = COPY[currentLanguage];
  if (!confirm(copy.confirmDelete(prompt.name))) return;
  promptLibrary = await AtlasPrompts.save(AtlasPrompts.remove(promptLibrary, prompt.id));
  renderPromptLibrary();
  saveStatus.textContent = copy.promptDeleted;
}

function exportPromptLibrary() {
  const blob = new Blob([AtlasPrompts.exportJson(promptLibrary)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `atlas-sidebar-prompts-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  saveStatus.textContent = COPY[currentLanguage].exported;
}

async function importPromptFile() {
  const [file] = importPromptsInput.files || [];
  importPromptsInput.value = "";
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error(
        currentLanguage === "zh-CN"
          ? "导入文件超过 5 MB，无法读取。"
          : "The import file is larger than 5 MB."
      );
    }
    const result = AtlasPrompts.importJson(await file.text(), promptLibrary);
    promptLibrary = await AtlasPrompts.save(result.library);
    renderPromptLibrary();
    saveStatus.textContent = COPY[currentLanguage].imported(result.imported);
  } catch (error) {
    saveStatus.textContent = AtlasPrompts.formatError(error, currentLanguage);
  }
}
