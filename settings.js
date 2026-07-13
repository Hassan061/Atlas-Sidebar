(function installAtlasSettings(global) {
  const STORAGE_KEY = "atlasSettings";
  const FEATURE_IDS = Object.freeze([
    "link",
    "screenshot",
    "document",
    "local-file",
    "prompt",
    "transcript"
  ]);
  const UI_LANGUAGES = Object.freeze([
    "zh-CN",
    "en",
    "es",
    "fr",
    "de",
    "ja",
    "ko",
    "pt-BR"
  ]);
  const TOOLBAR_MODES = Object.freeze(["system", "light", "dark"]);
  const TOOLBAR_THEMES = Object.freeze(["classic", "ocean", "graphite"]);
  const DEFAULTS = Object.freeze({
    version: 2,
    uiLanguage: "zh-CN",
    transcriptLanguage: "auto",
    captureOrder: FEATURE_IDS,
    toolbarMode: "system",
    toolbarTheme: "classic"
  });

  const MESSAGES = Object.freeze({
    "zh-CN": Object.freeze({
      settings: "设置",
      toolbar: "侧边栏浏览器工具栏",
      navigation: "页面导航",
      back: "后退",
      backTitle: "上一条输入的网址",
      forward: "前进",
      forwardTitle: "下一条输入的网址",
      reload: "刷新",
      reloadTitle: "重新加载",
      address: "网址",
      addressPlaceholder: "输入网址",
      openUrl: "打开网址",
      openExternal: "在标签页打开",
      pages: "页面",
      closePages: "关闭页面列表",
      currentPage: "当前页面",
      customPageName: "自定义页面名称",
      savePageName: "保存名称",
      searchPages: "搜索页面",
      searchPagesPlaceholder: "搜索名称、标题、域名或网址",
      pageScope: "页面范围",
      showAll: "查看全部",
      noPageMatches: "没有匹配的页面。",
      selectPage: "选择页面",
      editSavedPage: "编辑已保存页面名称",
      saveEdit: "保存编辑",
      cancelEdit: "取消编辑",
      selectCurrentResults: "全选当前结果",
      deselectCurrentResults: "取消全选",
      deleteSelected: "删除所选",
      selectedPageCount: "已选 {count}",
      deletedPageCount: "已删除 {count} 个页面。",
      saveCurrent: "保存当前",
      updateSaved: "更新保存",
      savedPages: "已保存",
      recentPages: "最近访问",
      clearRecent: "清空最近",
      noSavedPages: "还没有保存页面。",
      noRecentPages: "还没有最近访问。",
      openSavedPage: "打开页面",
      removeSavedPage: "删除已保存页面",
      removeRecentPage: "移除最近访问",
      materials: "临时素材",
      materialScope: "素材范围",
      currentTab: "当前标签页",
      allMaterials: "全部素材",
      clear: "清空",
      closeMaterials: "关闭临时素材",
      captureGroup: "添加当前页面内容",
      link: "链接",
      screenshot: "截图",
      document: "文档",
      localFile: "本地文件",
      transcript: "字幕",
      prompt: "提示词",
      documentSource: "文档来源",
      transcriptLanguage: "字幕语言",
      detectingTranscript: "正在检测字幕…",
      emptyHint: "在网页中选中文字，点击选区旁的＋或右键添加到 Atlas Sidebar。",
      materialList: "临时素材列表",
      copyDiagnostics: "复制诊断",
      copySelected: "复制所选",
      addToChatGPT: "添加到 ChatGPT",
      webContent: "网页内容",
      pageUnavailable: "这个页面暂时无法在侧边栏打开",
      retry: "重试",
      openInTab: "改在标签页打开",
      ready: "准备就绪",
      addSelectionMenu: "添加选中文字到 Atlas Sidebar",
      addPageLinkMenu: "添加当前页面链接到 Atlas Sidebar",
      addTranscriptMenu: "添加视频字幕到 Atlas Sidebar",
      addScreenshotMenu: "截图当前可见区域到 Atlas Sidebar",
      addDocumentMenu: "添加当前文档到 Atlas Sidebar"
    }),
    en: Object.freeze({
      settings: "Settings",
      toolbar: "Sidebar browser toolbar",
      navigation: "Page navigation",
      back: "Back",
      backTitle: "Previous entered address",
      forward: "Forward",
      forwardTitle: "Next entered address",
      reload: "Reload",
      reloadTitle: "Reload page",
      address: "Address",
      addressPlaceholder: "Enter a web address",
      openUrl: "Open address",
      openExternal: "Open in tab",
      pages: "Pages",
      closePages: "Close page list",
      currentPage: "Current page",
      customPageName: "Custom page name",
      savePageName: "Save name",
      searchPages: "Search pages",
      searchPagesPlaceholder: "Search names, titles, domains, or URLs",
      pageScope: "Page scope",
      showAll: "Show all",
      noPageMatches: "No matching pages.",
      selectPage: "Select page",
      editSavedPage: "Edit saved page name",
      saveEdit: "Save edit",
      cancelEdit: "Cancel edit",
      selectCurrentResults: "Select current results",
      deselectCurrentResults: "Deselect all",
      deleteSelected: "Delete selected",
      selectedPageCount: "{count} selected",
      deletedPageCount: "{count} pages deleted.",
      saveCurrent: "Save current",
      updateSaved: "Update saved",
      savedPages: "Saved",
      recentPages: "Recent",
      clearRecent: "Clear recent",
      noSavedPages: "No saved pages yet.",
      noRecentPages: "No recent visits yet.",
      openSavedPage: "Open page",
      removeSavedPage: "Delete saved page",
      removeRecentPage: "Remove recent visit",
      materials: "Temporary materials",
      materialScope: "Material scope",
      currentTab: "Current tab",
      allMaterials: "All materials",
      clear: "Clear",
      closeMaterials: "Close temporary materials",
      captureGroup: "Add content from the current page",
      link: "Link",
      screenshot: "Screenshot",
      document: "Document",
      localFile: "Local file",
      transcript: "Transcript",
      prompt: "Prompt",
      documentSource: "Document source",
      transcriptLanguage: "Transcript language",
      detectingTranscript: "Detecting transcripts…",
      emptyHint: "Select text on a page, then use the nearby + or right-click to add it.",
      materialList: "Temporary material list",
      copyDiagnostics: "Copy diagnostics",
      copySelected: "Copy selected",
      addToChatGPT: "Add to ChatGPT",
      webContent: "Web content",
      pageUnavailable: "This page cannot be opened in the sidebar right now",
      retry: "Retry",
      openInTab: "Open in a tab instead",
      ready: "Ready",
      addSelectionMenu: "Add selected text to Atlas Sidebar",
      addPageLinkMenu: "Add current page link to Atlas Sidebar",
      addTranscriptMenu: "Add video transcript to Atlas Sidebar",
      addScreenshotMenu: "Capture visible area to Atlas Sidebar",
      addDocumentMenu: "Add current document to Atlas Sidebar"
    }),
    es: Object.freeze({
      settings: "Configuración", toolbar: "Barra del navegador lateral", navigation: "Navegación",
      back: "Atrás", backTitle: "Dirección anterior", forward: "Adelante", forwardTitle: "Dirección siguiente",
      reload: "Recargar", reloadTitle: "Recargar página", address: "Dirección", addressPlaceholder: "Introduce una dirección web",
      openUrl: "Abrir dirección", openExternal: "Abrir en una pestaña", pages: "Páginas", closePages: "Cerrar lista de páginas",
      currentPage: "Página actual", customPageName: "Nombre personalizado", savePageName: "Guardar nombre", searchPages: "Buscar páginas", searchPagesPlaceholder: "Buscar nombres, títulos, dominios o URL", pageScope: "Ámbito de páginas", showAll: "Ver todo", noPageMatches: "No hay páginas coincidentes.", selectPage: "Seleccionar página", editSavedPage: "Editar nombre guardado", saveEdit: "Guardar edición", cancelEdit: "Cancelar edición", selectCurrentResults: "Seleccionar resultados actuales", deselectCurrentResults: "Deseleccionar todo", deleteSelected: "Eliminar seleccionados", selectedPageCount: "{count} seleccionados", deletedPageCount: "Se eliminaron {count} páginas.", saveCurrent: "Guardar actual", updateSaved: "Actualizar guardada", savedPages: "Guardadas",
      recentPages: "Recientes", clearRecent: "Borrar recientes", noSavedPages: "Aún no hay páginas guardadas.", noRecentPages: "Aún no hay visitas recientes.",
      openSavedPage: "Abrir página", removeSavedPage: "Eliminar página guardada", removeRecentPage: "Quitar visita reciente", materials: "Materiales temporales",
      materialScope: "Ámbito", currentTab: "Pestaña actual", allMaterials: "Todos los materiales", clear: "Borrar",
      closeMaterials: "Cerrar materiales", captureGroup: "Añadir contenido de la página actual", link: "Enlace",
      screenshot: "Captura", document: "Documento", localFile: "Archivo local", transcript: "Subtítulos", prompt: "Prompt",
      documentSource: "Origen del documento", transcriptLanguage: "Idioma de subtítulos", detectingTranscript: "Detectando subtítulos…",
      emptyHint: "Selecciona texto y usa el + cercano o el menú contextual para añadirlo.",
      materialList: "Lista de materiales temporales", copyDiagnostics: "Copiar diagnóstico", copySelected: "Copiar selección", addToChatGPT: "Añadir a ChatGPT",
      webContent: "Contenido web", pageUnavailable: "Esta página no se puede abrir ahora en la barra lateral", retry: "Reintentar",
      openInTab: "Abrir en una pestaña", ready: "Listo", addSelectionMenu: "Añadir texto seleccionado a Atlas Sidebar",
      addPageLinkMenu: "Añadir enlace de la página a Atlas Sidebar", addTranscriptMenu: "Añadir subtítulos de vídeo a Atlas Sidebar",
      addScreenshotMenu: "Capturar el área visible en Atlas Sidebar", addDocumentMenu: "Añadir documento actual a Atlas Sidebar"
    }),
    fr: Object.freeze({
      settings: "Paramètres", toolbar: "Barre du navigateur latéral", navigation: "Navigation",
      back: "Précédent", backTitle: "Adresse précédente", forward: "Suivant", forwardTitle: "Adresse suivante",
      reload: "Actualiser", reloadTitle: "Actualiser la page", address: "Adresse", addressPlaceholder: "Saisissez une adresse web",
      openUrl: "Ouvrir l’adresse", openExternal: "Ouvrir dans un onglet", pages: "Pages", closePages: "Fermer la liste des pages",
      currentPage: "Page actuelle", customPageName: "Nom personnalisé", savePageName: "Enregistrer le nom", searchPages: "Rechercher des pages", searchPagesPlaceholder: "Rechercher noms, titres, domaines ou URL", pageScope: "Portée des pages", showAll: "Tout afficher", noPageMatches: "Aucune page correspondante.", selectPage: "Sélectionner la page", editSavedPage: "Modifier le nom enregistré", saveEdit: "Enregistrer la modification", cancelEdit: "Annuler", selectCurrentResults: "Sélectionner les résultats", deselectCurrentResults: "Tout désélectionner", deleteSelected: "Supprimer la sélection", selectedPageCount: "{count} sélectionnés", deletedPageCount: "{count} pages supprimées.", saveCurrent: "Enregistrer", updateSaved: "Mettre à jour", savedPages: "Enregistrées",
      recentPages: "Récentes", clearRecent: "Effacer les récentes", noSavedPages: "Aucune page enregistrée.", noRecentPages: "Aucune visite récente.",
      openSavedPage: "Ouvrir la page", removeSavedPage: "Supprimer la page enregistrée", removeRecentPage: "Retirer la visite récente", materials: "Éléments temporaires",
      materialScope: "Portée", currentTab: "Onglet actuel", allMaterials: "Tous les éléments", clear: "Effacer",
      closeMaterials: "Fermer les éléments", captureGroup: "Ajouter le contenu de la page actuelle", link: "Lien",
      screenshot: "Capture", document: "Document", localFile: "Fichier local", transcript: "Sous-titres", prompt: "Prompt",
      documentSource: "Source du document", transcriptLanguage: "Langue des sous-titres", detectingTranscript: "Détection des sous-titres…",
      emptyHint: "Sélectionnez du texte, puis utilisez le + voisin ou le clic droit pour l’ajouter.",
      materialList: "Liste des éléments temporaires", copyDiagnostics: "Copier le diagnostic", copySelected: "Copier la sélection", addToChatGPT: "Ajouter à ChatGPT",
      webContent: "Contenu web", pageUnavailable: "Cette page ne peut pas être ouverte dans la barre latérale", retry: "Réessayer",
      openInTab: "Ouvrir dans un onglet", ready: "Prêt", addSelectionMenu: "Ajouter le texte sélectionné à Atlas Sidebar",
      addPageLinkMenu: "Ajouter le lien de la page à Atlas Sidebar", addTranscriptMenu: "Ajouter les sous-titres vidéo à Atlas Sidebar",
      addScreenshotMenu: "Capturer la zone visible dans Atlas Sidebar", addDocumentMenu: "Ajouter le document actuel à Atlas Sidebar"
    }),
    de: Object.freeze({
      settings: "Einstellungen", toolbar: "Seitenleisten-Browserleiste", navigation: "Navigation",
      back: "Zurück", backTitle: "Vorherige Adresse", forward: "Vorwärts", forwardTitle: "Nächste Adresse",
      reload: "Neu laden", reloadTitle: "Seite neu laden", address: "Adresse", addressPlaceholder: "Webadresse eingeben",
      openUrl: "Adresse öffnen", openExternal: "In Tab öffnen", pages: "Seiten", closePages: "Seitenliste schließen",
      currentPage: "Aktuelle Seite", customPageName: "Eigener Seitenname", savePageName: "Namen speichern", searchPages: "Seiten suchen", searchPagesPlaceholder: "Namen, Titel, Domains oder URLs suchen", pageScope: "Seitenbereich", showAll: "Alle anzeigen", noPageMatches: "Keine passenden Seiten.", selectPage: "Seite auswählen", editSavedPage: "Gespeicherten Namen bearbeiten", saveEdit: "Änderung speichern", cancelEdit: "Abbrechen", selectCurrentResults: "Aktuelle Ergebnisse auswählen", deselectCurrentResults: "Auswahl aufheben", deleteSelected: "Auswahl löschen", selectedPageCount: "{count} ausgewählt", deletedPageCount: "{count} Seiten gelöscht.", saveCurrent: "Aktuelle speichern", updateSaved: "Gespeicherte aktualisieren", savedPages: "Gespeichert",
      recentPages: "Zuletzt besucht", clearRecent: "Verlauf leeren", noSavedPages: "Noch keine gespeicherten Seiten.", noRecentPages: "Noch keine letzten Besuche.",
      openSavedPage: "Seite öffnen", removeSavedPage: "Gespeicherte Seite löschen", removeRecentPage: "Letzten Besuch entfernen", materials: "Temporäre Materialien",
      materialScope: "Umfang", currentTab: "Aktueller Tab", allMaterials: "Alle Materialien", clear: "Leeren",
      closeMaterials: "Materialien schließen", captureGroup: "Inhalt der aktuellen Seite hinzufügen", link: "Link",
      screenshot: "Screenshot", document: "Dokument", localFile: "Lokale Datei", transcript: "Untertitel", prompt: "Prompt",
      documentSource: "Dokumentquelle", transcriptLanguage: "Untertitelsprache", detectingTranscript: "Untertitel werden erkannt…",
      emptyHint: "Text markieren und über das + daneben oder per Rechtsklick hinzufügen.",
      materialList: "Liste temporärer Materialien", copyDiagnostics: "Diagnose kopieren", copySelected: "Auswahl kopieren", addToChatGPT: "Zu ChatGPT hinzufügen",
      webContent: "Webinhalt", pageUnavailable: "Diese Seite kann derzeit nicht in der Seitenleiste geöffnet werden", retry: "Erneut versuchen",
      openInTab: "Stattdessen in Tab öffnen", ready: "Bereit", addSelectionMenu: "Markierten Text zu Atlas Sidebar hinzufügen",
      addPageLinkMenu: "Link der aktuellen Seite zu Atlas Sidebar hinzufügen", addTranscriptMenu: "Video-Untertitel zu Atlas Sidebar hinzufügen",
      addScreenshotMenu: "Sichtbaren Bereich in Atlas Sidebar erfassen", addDocumentMenu: "Aktuelles Dokument zu Atlas Sidebar hinzufügen"
    }),
    ja: Object.freeze({
      settings: "設定", toolbar: "サイドバーブラウザーのツールバー", navigation: "ページ移動",
      back: "戻る", backTitle: "前のアドレス", forward: "進む", forwardTitle: "次のアドレス",
      reload: "再読み込み", reloadTitle: "ページを再読み込み", address: "アドレス", addressPlaceholder: "ウェブアドレスを入力",
      openUrl: "アドレスを開く", openExternal: "タブで開く", pages: "ページ", closePages: "ページ一覧を閉じる",
      currentPage: "現在のページ", customPageName: "カスタムページ名", savePageName: "名前を保存", searchPages: "ページを検索", searchPagesPlaceholder: "名前、タイトル、ドメイン、URLを検索", pageScope: "ページ範囲", showAll: "すべて表示", noPageMatches: "一致するページはありません。", selectPage: "ページを選択", editSavedPage: "保存名を編集", saveEdit: "編集を保存", cancelEdit: "キャンセル", selectCurrentResults: "現在の結果を選択", deselectCurrentResults: "すべて解除", deleteSelected: "選択を削除", selectedPageCount: "{count} 件選択", deletedPageCount: "{count} 件のページを削除しました。", saveCurrent: "現在を保存", updateSaved: "保存を更新", savedPages: "保存済み",
      recentPages: "最近のアクセス", clearRecent: "最近を消去", noSavedPages: "保存したページはありません。", noRecentPages: "最近のアクセスはありません。",
      openSavedPage: "ページを開く", removeSavedPage: "保存ページを削除", removeRecentPage: "最近のアクセスから削除", materials: "一時素材", materialScope: "素材の範囲",
      currentTab: "現在のタブ", allMaterials: "すべての素材", clear: "クリア", closeMaterials: "一時素材を閉じる",
      captureGroup: "現在のページから追加", link: "リンク", screenshot: "スクリーンショット", document: "文書",
      localFile: "ローカルファイル", transcript: "字幕", prompt: "プロンプト", documentSource: "文書の取得元",
      transcriptLanguage: "字幕の言語", detectingTranscript: "字幕を検出中…",
      emptyHint: "テキストを選択し、近くの＋または右クリックで追加します。",
      materialList: "一時素材の一覧", copyDiagnostics: "診断情報をコピー", copySelected: "選択項目をコピー", addToChatGPT: "ChatGPT に追加",
      webContent: "ウェブコンテンツ", pageUnavailable: "このページは現在サイドバーで開けません", retry: "再試行",
      openInTab: "タブで開く", ready: "準備完了", addSelectionMenu: "選択したテキストを Atlas Sidebar に追加",
      addPageLinkMenu: "現在のページのリンクを Atlas Sidebar に追加", addTranscriptMenu: "動画字幕を Atlas Sidebar に追加",
      addScreenshotMenu: "表示中の範囲を Atlas Sidebar にキャプチャ", addDocumentMenu: "現在の文書を Atlas Sidebar に追加"
    }),
    ko: Object.freeze({
      settings: "설정", toolbar: "사이드바 브라우저 도구 모음", navigation: "페이지 탐색",
      back: "뒤로", backTitle: "이전 주소", forward: "앞으로", forwardTitle: "다음 주소",
      reload: "새로고침", reloadTitle: "페이지 새로고침", address: "주소", addressPlaceholder: "웹 주소 입력",
      openUrl: "주소 열기", openExternal: "탭에서 열기", pages: "페이지", closePages: "페이지 목록 닫기",
      currentPage: "현재 페이지", customPageName: "사용자 지정 페이지 이름", savePageName: "이름 저장", searchPages: "페이지 검색", searchPagesPlaceholder: "이름, 제목, 도메인 또는 URL 검색", pageScope: "페이지 범위", showAll: "모두 보기", noPageMatches: "일치하는 페이지가 없습니다.", selectPage: "페이지 선택", editSavedPage: "저장된 이름 편집", saveEdit: "편집 저장", cancelEdit: "취소", selectCurrentResults: "현재 결과 선택", deselectCurrentResults: "전체 선택 해제", deleteSelected: "선택 삭제", selectedPageCount: "{count}개 선택", deletedPageCount: "{count}개 페이지를 삭제했습니다.", saveCurrent: "현재 페이지 저장", updateSaved: "저장 항목 업데이트", savedPages: "저장됨",
      recentPages: "최근 방문", clearRecent: "최근 기록 지우기", noSavedPages: "저장된 페이지가 없습니다.", noRecentPages: "최근 방문이 없습니다.",
      openSavedPage: "페이지 열기", removeSavedPage: "저장된 페이지 삭제", removeRecentPage: "최근 방문 삭제", materials: "임시 자료", materialScope: "자료 범위",
      currentTab: "현재 탭", allMaterials: "모든 자료", clear: "비우기", closeMaterials: "임시 자료 닫기",
      captureGroup: "현재 페이지에서 추가", link: "링크", screenshot: "스크린샷", document: "문서",
      localFile: "로컬 파일", transcript: "자막", prompt: "프롬프트", documentSource: "문서 출처",
      transcriptLanguage: "자막 언어", detectingTranscript: "자막 감지 중…",
      emptyHint: "텍스트를 선택한 뒤 옆의 ＋ 또는 오른쪽 클릭으로 추가하세요.",
      materialList: "임시 자료 목록", copyDiagnostics: "진단 복사", copySelected: "선택 항목 복사", addToChatGPT: "ChatGPT에 추가",
      webContent: "웹 콘텐츠", pageUnavailable: "현재 이 페이지를 사이드바에서 열 수 없습니다", retry: "다시 시도",
      openInTab: "탭에서 열기", ready: "준비됨", addSelectionMenu: "선택한 텍스트를 Atlas Sidebar에 추가",
      addPageLinkMenu: "현재 페이지 링크를 Atlas Sidebar에 추가", addTranscriptMenu: "동영상 자막을 Atlas Sidebar에 추가",
      addScreenshotMenu: "현재 보이는 영역을 Atlas Sidebar에 캡처", addDocumentMenu: "현재 문서를 Atlas Sidebar에 추가"
    }),
    "pt-BR": Object.freeze({
      settings: "Configurações", toolbar: "Barra do navegador lateral", navigation: "Navegação",
      back: "Voltar", backTitle: "Endereço anterior", forward: "Avançar", forwardTitle: "Próximo endereço",
      reload: "Recarregar", reloadTitle: "Recarregar página", address: "Endereço", addressPlaceholder: "Digite um endereço da web",
      openUrl: "Abrir endereço", openExternal: "Abrir em uma guia", pages: "Páginas", closePages: "Fechar lista de páginas",
      currentPage: "Página atual", customPageName: "Nome personalizado", savePageName: "Salvar nome", searchPages: "Pesquisar páginas", searchPagesPlaceholder: "Pesquisar nomes, títulos, domínios ou URLs", pageScope: "Escopo de páginas", showAll: "Ver tudo", noPageMatches: "Nenhuma página correspondente.", selectPage: "Selecionar página", editSavedPage: "Editar nome salvo", saveEdit: "Salvar edição", cancelEdit: "Cancelar", selectCurrentResults: "Selecionar resultados atuais", deselectCurrentResults: "Desmarcar tudo", deleteSelected: "Excluir selecionados", selectedPageCount: "{count} selecionados", deletedPageCount: "{count} páginas excluídas.", saveCurrent: "Salvar atual", updateSaved: "Atualizar salva", savedPages: "Salvas",
      recentPages: "Recentes", clearRecent: "Limpar recentes", noSavedPages: "Ainda não há páginas salvas.", noRecentPages: "Ainda não há visitas recentes.",
      openSavedPage: "Abrir página", removeSavedPage: "Excluir página salva", removeRecentPage: "Remover visita recente", materials: "Materiais temporários",
      materialScope: "Escopo", currentTab: "Guia atual", allMaterials: "Todos os materiais", clear: "Limpar",
      closeMaterials: "Fechar materiais", captureGroup: "Adicionar conteúdo da página atual", link: "Link",
      screenshot: "Captura", document: "Documento", localFile: "Arquivo local", transcript: "Legendas", prompt: "Prompt",
      documentSource: "Origem do documento", transcriptLanguage: "Idioma das legendas", detectingTranscript: "Detectando legendas…",
      emptyHint: "Selecione um texto e use o + ao lado ou o menu de contexto para adicioná-lo.",
      materialList: "Lista de materiais temporários", copyDiagnostics: "Copiar diagnóstico", copySelected: "Copiar selecionados", addToChatGPT: "Adicionar ao ChatGPT",
      webContent: "Conteúdo da web", pageUnavailable: "Esta página não pode ser aberta agora na barra lateral", retry: "Tentar novamente",
      openInTab: "Abrir em uma guia", ready: "Pronto", addSelectionMenu: "Adicionar texto selecionado ao Atlas Sidebar",
      addPageLinkMenu: "Adicionar link da página ao Atlas Sidebar", addTranscriptMenu: "Adicionar legendas de vídeo ao Atlas Sidebar",
      addScreenshotMenu: "Capturar área visível no Atlas Sidebar", addDocumentMenu: "Adicionar documento atual ao Atlas Sidebar"
    })
  });

  function normalize(value) {
    const source = value && typeof value === "object" ? value : {};
    const appearance = normalizeToolbarAppearance(source);
    return {
      version: DEFAULTS.version,
      uiLanguage: UI_LANGUAGES.includes(source.uiLanguage)
        ? source.uiLanguage
        : DEFAULTS.uiLanguage,
      transcriptLanguage: normalizeLanguage(source.transcriptLanguage),
      captureOrder: normalizeOrder(source.captureOrder),
      toolbarMode: appearance.mode,
      toolbarTheme: appearance.theme
    };
  }

  function normalizeToolbarAppearance(source) {
    const value = source && typeof source === "object" ? source : {};
    if (TOOLBAR_MODES.includes(value.toolbarMode)) {
      return {
        mode: value.toolbarMode,
        theme: TOOLBAR_THEMES.includes(value.toolbarTheme)
          ? value.toolbarTheme
          : DEFAULTS.toolbarTheme
      };
    }
    return {
      system: { mode: "system", theme: "classic" },
      light: { mode: "light", theme: "classic" },
      dark: { mode: "dark", theme: "classic" },
      ocean: { mode: "light", theme: "ocean" },
      graphite: { mode: "dark", theme: "graphite" },
      classic: { mode: "system", theme: "classic" }
    }[value.toolbarTheme] || {
      mode: DEFAULTS.toolbarMode,
      theme: DEFAULTS.toolbarTheme
    };
  }

  function normalizeLanguage(value) {
    const language = String(value || "").trim();
    if (!language || language.toLowerCase() === "auto") return "auto";
    if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(language)) return "auto";
    return language;
  }

  function normalizeOrder(value) {
    const seen = new Set();
    const normalized = [];
    for (const id of Array.isArray(value) ? value : []) {
      if (!FEATURE_IDS.includes(id) || seen.has(id)) continue;
      seen.add(id);
      normalized.push(id);
    }
    for (const id of FEATURE_IDS) {
      if (!seen.has(id)) normalized.push(id);
    }
    return normalized;
  }

  function reorderFeature(value, draggedId, targetId, placement = "before") {
    const order = normalizeOrder(value);
    if (
      draggedId === targetId ||
      !FEATURE_IDS.includes(draggedId) ||
      !FEATURE_IDS.includes(targetId)
    ) {
      return order;
    }
    const next = order.filter((id) => id !== draggedId);
    const targetIndex = next.indexOf(targetId);
    const insertionIndex = targetIndex + (placement === "after" ? 1 : 0);
    next.splice(insertionIndex, 0, draggedId);
    return next;
  }

  function resolveTranscriptLanguage(settings, browserLanguage) {
    const preferred = normalize(settings).transcriptLanguage;
    return preferred === "auto"
      ? normalizeLanguage(browserLanguage) === "auto"
        ? "en"
        : normalizeLanguage(browserLanguage)
      : preferred;
  }

  function t(language, key) {
    const locale = UI_LANGUAGES.includes(language) ? language : DEFAULTS.uiLanguage;
    return MESSAGES[locale][key] || MESSAGES[DEFAULTS.uiLanguage][key] || key;
  }

  async function load(storageArea = global.chrome?.storage?.local) {
    if (!storageArea?.get) return normalize();
    const stored = await storageArea.get(STORAGE_KEY);
    return normalize(stored?.[STORAGE_KEY]);
  }

  async function save(value, storageArea = global.chrome?.storage?.local) {
    const normalized = normalize(value);
    if (!storageArea?.set) return normalized;
    await storageArea.set({ [STORAGE_KEY]: normalized });
    return normalized;
  }

  global.AtlasSettings = Object.freeze({
    STORAGE_KEY,
    FEATURE_IDS,
    UI_LANGUAGES,
    TOOLBAR_MODES,
    TOOLBAR_THEMES,
    DEFAULTS,
    MESSAGES,
    normalize,
    normalizeLanguage,
    normalizeOrder,
    normalizeToolbarAppearance,
    reorderFeature,
    resolveTranscriptLanguage,
    t,
    load,
    save
  });
})(globalThis);
