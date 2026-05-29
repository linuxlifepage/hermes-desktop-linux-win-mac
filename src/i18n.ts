import englishStrings from "./locales/en.strings?raw";
import russianStrings from "./locales/ru.strings?raw";
import chineseStrings from "./locales/zh-Hans.strings?raw";

export type AppLocale = "en" | "ru" | "zh-Hans";

export const appLocales: Array<{ id: AppLocale; label: string }> = [
  { id: "en", label: "English" },
  { id: "ru", label: "Русский" },
  { id: "zh-Hans", label: "简体中文" },
];

const dictionaries: Record<AppLocale, Map<string, string>> = {
  en: parseStrings(englishStrings),
  ru: parseStrings(russianStrings),
  "zh-Hans": parseStrings(chineseStrings),
};

const overlayTranslations: Record<AppLocale, Record<string, string>> = {
  en: {
    "Hermes Desktop": "Hermes Desktop",
    Language: "Language",
    Updates: "Updates",
    Checking: "Checking",
    "Check for updates": "Check for updates",
    "Auto checks": "Auto checks",
    "Open Release": "Open Release",
    Dismiss: "Dismiss",
    "Create or select an SSH profile to start.": "Create or select an SSH profile to start.",
    "Unknown error.": "Unknown error.",
    "Network request failed. Check your connection and try again.": "Network request failed. Check your connection and try again.",
    "No active Hermes host": "No active Hermes host",
    "Loading workspace": "Loading workspace",
    "Saving connection": "Saving connection",
    "Connection saved.": "Connection saved.",
    "Testing SSH connection": "Testing SSH connection",
    "SSH OK: %@": "SSH OK: %@",
    "Selecting host": "Selecting host",
    "Active host selected.": "Active host selected.",
    "Deleting connection": "Deleting connection",
    "Connection deleted.": "Connection deleted.",
    "Refreshing remote workspace": "Refreshing remote workspace",
    "Connected to %@": "Connected to %@",
    "Language updated.": "Language updated.",
    "Automatic update checks enabled.": "Automatic update checks enabled.",
    "Automatic update checks disabled.": "Automatic update checks disabled.",
    "Checking for Hermes Desktop updates...": "Checking for Hermes Desktop updates...",
    "Hermes Desktop %@ is up to date.": "Hermes Desktop %@ is up to date.",
    "Opening Hermes Desktop %@ release.": "Opening Hermes Desktop %@ release.",
    "Terminal output cleared.": "Terminal output cleared.",
    "Terminal tab opened.": "Terminal tab opened.",
    "Terminal tab closed.": "Terminal tab closed.",
    "Terminal command is required.": "Terminal command is required.",
    "Terminal control sequence ignored.": "Terminal control sequence ignored.",
    "Running terminal command": "Running terminal command",
    "Terminal command exited with code %@.": "Terminal command exited with code %@.",
    "Starting terminal session": "Starting terminal session",
    "Opening workflow in Terminal": "Opening workflow in Terminal",
    "Opening workflow in Chat": "Opening workflow in Chat",
    "Opening session in Terminal": "Opening session in Terminal",
    "Opening %@ in Terminal.": "Opening %@ in Terminal.",
    "Opening %@ in Chat.": "Opening %@ in Chat.",
    "Loading usage totals": "Loading usage totals",
    "Usage totals loaded.": "Usage totals loaded.",
    "Usage unavailable.": "Usage unavailable.",
    "Loading workflows": "Loading workflows",
    "Loaded %@ workflows.": "Loaded %@ workflows.",
    "Creating workflow": "Creating workflow",
    "Saving workflow": "Saving workflow",
    "%@ saved.": "%@ saved.",
    "Removing workflow": "Removing workflow",
    "Workflow removed.": "Workflow removed.",
    "Preparing workflow launch command": "Preparing workflow launch command",
    "Workflow launch command prepared.": "Workflow launch command prepared.",
    "Workflow cannot run while assigned skills are unavailable on this host/profile.": "Workflow cannot run while assigned skills are unavailable on this host/profile.",
    "Select a workflow before saving.": "Select a workflow before saving.",
    "Loading skills": "Loading skills",
    "Loaded %@ skills.": "Loaded %@ skills.",
    "Loading skill detail": "Loading skill detail",
    "Creating skill": "Creating skill",
    "Saving skill": "Saving skill",
    "Loaded %@.": "Loaded %@.",
    "Discard unsaved skill edits?": "Discard unsaved skill edits?",
    "Select a skill before saving.": "Select a skill before saving.",
    "Loading cron jobs": "Loading cron jobs",
    "Loaded %@ cron jobs.": "Loaded %@ cron jobs.",
    "Creating cron job": "Creating cron job",
    "Saving cron job": "Saving cron job",
    "Cron job saved.": "Cron job saved.",
    "Running cron job": "Running cron job",
    "Cron job started.": "Cron job started.",
    "Resuming cron job": "Resuming cron job",
    "Pausing cron job": "Pausing cron job",
    "Cron job resumed.": "Cron job resumed.",
    "Cron job paused.": "Cron job paused.",
    "Removing cron job": "Removing cron job",
    "Cron job removed.": "Cron job removed.",
    "Loading Kanban": "Loading Kanban",
    "Loaded %@ Kanban tasks.": "Loaded %@ Kanban tasks.",
    "Loading Kanban task": "Loading Kanban task",
    "Creating Kanban board": "Creating Kanban board",
    "Kanban board created.": "Kanban board created.",
    "Saving Kanban task": "Saving Kanban task",
    "Kanban task saved.": "Kanban task saved.",
    "Comment text is required.": "Comment text is required.",
    "Recovery result is required.": "Recovery result is required.",
    "Recovery metadata must be a JSON object.": "Recovery metadata must be a JSON object.",
    "Adding Kanban comment": "Adding Kanban comment",
    "Assigning Kanban task": "Assigning Kanban task",
    "Saving Kanban parents": "Saving Kanban parents",
    "Saving Kanban children": "Saving Kanban children",
    "Specifying Kanban task": "Specifying Kanban task",
    "Blocking Kanban task": "Blocking Kanban task",
    "Unblocking Kanban task": "Unblocking Kanban task",
    "Completing Kanban task": "Completing Kanban task",
    "Reclaiming Kanban task": "Reclaiming Kanban task",
    "Reassigning Kanban task": "Reassigning Kanban task",
    "Editing Kanban result": "Editing Kanban result",
    "Updating Kanban home subscription": "Updating Kanban home subscription",
    "Deleting Kanban task": "Deleting Kanban task",
    "Archiving Kanban task": "Archiving Kanban task",
    "Kanban task updated.": "Kanban task updated.",
    "Nudging Kanban dispatcher": "Nudging Kanban dispatcher",
    "Archiving Kanban board": "Archiving Kanban board",
    "Kanban board archived.": "Kanban board archived.",
    "Loading remote file": "Loading remote file",
    "Saving remote file": "Saving remote file",
    "Reload the file before saving.": "Reload the file before saving.",
    "Local edits discarded.": "Local edits discarded.",
    "Browsing remote files": "Browsing remote files",
    "%@ remote items.": "%@ remote items.",
    "%@ added to Workspace Files.": "%@ added to Workspace Files.",
    "Bookmark removed.": "Bookmark removed.",
    "Loading sessions": "Loading sessions",
    "Loading more sessions": "Loading more sessions",
    "Loaded %@ of %@ sessions.": "Loaded %@ of %@ sessions.",
    "Loading transcript": "Loading transcript",
    "Loaded %@ transcript messages.": "Loaded %@ transcript messages.",
    "Sending prompt to Hermes": "Sending prompt to Hermes",
    "Prompt sent.": "Prompt sent.",
    "Session pinned.": "Session pinned.",
    "Session unpinned.": "Session unpinned.",
    "Terminal resume command prepared.": "Terminal resume command prepared.",
    "Deleting session": "Deleting session",
    "Session deleted.": "Session deleted.",
    "Port must be a positive number.": "Port must be a positive number.",
    "Port must be 65535 or lower.": "Port must be 65535 or lower.",
    "Discard unsaved Workspace Files edits before leaving Files?": "Discard unsaved Workspace Files edits before leaving Files?",
    "Discard unsaved Workspace Files edits before switching the active host?": "Discard unsaved Workspace Files edits before switching the active host?",
    "Delete connection \"%@\"?": "Delete connection \"%@\"?",
    "Remove workflow \"%@\"?": "Remove workflow \"%@\"?",
    "Remove cron job \"%@\"?": "Remove cron job \"%@\"?",
    "Delete Kanban task \"%@\"?": "Delete Kanban task \"%@\"?",
    "Archive Kanban board \"%@\"?": "Archive Kanban board \"%@\"?",
    "Discard unsaved edits in the current file?": "Discard unsaved edits in the current file?",
    "Remove bookmark \"%@\"? The remote file stays untouched.": "Remove bookmark \"%@\"? The remote file stays untouched.",
    "Delete remote session \"%@\"?": "Delete remote session \"%@\"?",
    "Theme updated.": "Theme updated.",
    "Switch to light mode": "Switch to light mode",
    "Switch to dark mode": "Switch to dark mode",
    "Switch to blue theme": "Switch to blue theme",
    "Switch to dark blue theme": "Switch to dark blue theme",
    "Switch to outline theme": "Switch to outline theme",
    "Choose theme": "Choose theme",
    Light: "Light",
    Dark: "Dark",
    Blue: "Blue",
    DarkBlue: "DarkBlue",
    Outline: "Outline",
    Connection: "Connection",
    "New connection": "New connection",
    "New Connection": "New Connection",
    "Saved Hosts": "Saved Hosts",
    "No connections saved yet.": "No connections saved yet.",
    Delete: "Delete",
    Name: "Name",
    "SSH alias": "SSH alias",
    "Host or IP": "Host or IP",
    User: "User",
    Port: "Port",
    "Hermes profile": "Hermes profile",
    "Custom Hermes home": "Custom Hermes home",
    Test: "Test",
    Save: "Save",
    "Use Host": "Use Host",
    "Search workflows": "Search workflows",
    "New Workflow": "New Workflow",
    "Workflow Details": "Workflow Details",
    Prompt: "Prompt",
    "Assigned Skills": "Assigned Skills",
    "No discovered skills available.": "No discovered skills available.",
    "Loading skills...": "Loading skills...",
    Remove: "Remove",
    "Launch Command": "Launch Command",
    "Run Terminal": "Run Terminal",
    "Run Chat": "Run Chat",
    Cancel: "Cancel",
    Create: "Create",
    "New Tab": "New Tab",
    "New Shell": "New Shell",
    "Saved Workflows": "Saved Workflows",
    "Refresh Workflows": "Refresh Workflows",
    "Loading workflows...": "Loading workflows...",
    "No matching workflows.": "No matching workflows.",
    "No workflows saved.": "No workflows saved.",
    "Select a workflow": "Select a workflow",
    "Choose a preset or create a new one for this host/profile.": "Choose a preset or create a new one for this host/profile.",
    "This workflow references skills that are unavailable on the active host/profile: %@": "This workflow references skills that are unavailable on the active host/profile: %@",
    "No skills assigned.": "No skills assigned.",
    "Terminal Launch Command": "Terminal Launch Command",
    "Terminal Initial Input": "Terminal Initial Input",
    "Terminal SSH startup command": "Terminal SSH startup command",
    "Chat Launch Command": "Chat Launch Command",
    "Chat Initial Input": "Chat Initial Input",
    "Chat SSH startup command": "Chat SSH startup command",
    "(empty)": "(empty)",
    "Local preset for the active host/profile": "Local preset for the active host/profile",
    Available: "Available",
    "Terminal theme": "Terminal theme",
    "No terminal tabs": "No terminal tabs",
    "No terminal tab": "No terminal tab",
    "Select a connection first": "Select a connection first",
    "Terminal tabs run on the active Hermes host over SSH.": "Terminal tabs run on the active Hermes host over SSH.",
    "Create a tab to start Hermes Chat TUI.": "Create a tab to start Hermes Chat TUI.",
    "Create a shell tab to work on the active SSH host.": "Create a shell tab to work on the active SSH host.",
    "Starting SSH terminal session...": "Starting SSH terminal session...",
    "Terminal exited with code %@.": "Terminal exited with code %@.",
    "Connected. Waiting for terminal output...": "Connected. Waiting for terminal output...",
    "Create a tab to start a live SSH shell.": "Create a tab to start a live SSH shell.",
    "Command Runner": "Command Runner",
    "Run Once": "Run Once",
    Clear: "Clear",
    Running: "Running",
    "Run Command": "Run Command",
    "Hermes Version": "Hermes Version",
    "List Directory": "List Directory",
    "Hermes Chat": "Hermes Chat",
    "No command output yet": "No command output yet",
    "Run a one-shot command to capture stdout, stderr, and exit code.": "Run a one-shot command to capture stdout, stderr, and exit code.",
    Reconnect: "Reconnect",
    Stop: "Stop",
    "Startup command": "Startup command",
    "Initial input sent": "Initial input sent",
    "Initial input pending": "Initial input pending",
    "Paste Again": "Paste Again",
    "Type a command or raw input": "Type a command or raw input",
    Send: "Send",
    Rerun: "Rerun",
    "Command produced no output.": "Command produced no output.",
    "Loading Kanban...": "Loading Kanban...",
    "Saving Kanban board...": "Saving Kanban board...",
    "Dispatching Kanban...": "Dispatching Kanban...",
    "Saving Kanban task...": "Saving Kanban task...",
    "Starting terminal session...": "Starting terminal session...",
  },
  ru: {
    "Hermes Desktop": "Hermes Desktop",
    Language: "Язык",
    Updates: "Обновления",
    Checking: "Проверка",
    "Check for updates": "Проверить обновления",
    "Auto checks": "Автопроверка",
    "Open Release": "Открыть релиз",
    Dismiss: "Скрыть",
    "Create or select an SSH profile to start.": "Создайте или выберите SSH-профиль, чтобы начать.",
    "Unknown error.": "Неизвестная ошибка.",
    "Network request failed. Check your connection and try again.": "Сетевой запрос не выполнен. Проверьте подключение и повторите попытку.",
    "No active Hermes host": "Нет активного хоста Hermes",
    "Loading workspace": "Загрузка рабочего пространства",
    "Saving connection": "Сохранение подключения",
    "Connection saved.": "Подключение сохранено.",
    "Testing SSH connection": "Проверка SSH-подключения",
    "SSH OK: %@": "SSH работает: %@",
    "Selecting host": "Выбор хоста",
    "Active host selected.": "Активный хост выбран.",
    "Deleting connection": "Удаление подключения",
    "Connection deleted.": "Подключение удалено.",
    "Refreshing remote workspace": "Обновление удаленного рабочего пространства",
    "Connected to %@": "Подключено к %@",
    "Language updated.": "Язык обновлен.",
    "Automatic update checks enabled.": "Автопроверка обновлений включена.",
    "Automatic update checks disabled.": "Автопроверка обновлений выключена.",
    "Checking for Hermes Desktop updates...": "Проверка обновлений Hermes Desktop...",
    "Hermes Desktop %@ is up to date.": "Hermes Desktop %@ актуален.",
    "Opening Hermes Desktop %@ release.": "Открытие релиза Hermes Desktop %@.",
    "Terminal output cleared.": "Вывод терминала очищен.",
    "Terminal tab opened.": "Вкладка терминала открыта.",
    "Terminal tab closed.": "Вкладка терминала закрыта.",
    "Terminal command is required.": "Нужна команда терминала.",
    "Terminal control sequence ignored.": "Управляющая последовательность терминала проигнорирована.",
    "Running terminal command": "Выполнение команды терминала",
    "Terminal command exited with code %@.": "Команда терминала завершилась с кодом %@.",
    "Starting terminal session": "Запуск терминальной сессии",
    "Opening workflow in Terminal": "Открытие workflow в терминале",
    "Opening workflow in Chat": "Открытие workflow в чате",
    "Opening session in Terminal": "Открытие сеанса в терминале",
    "Opening %@ in Terminal.": "Открытие %@ в терминале.",
    "Opening %@ in Chat.": "Открытие %@ в чате.",
    "Loading usage totals": "Загрузка статистики использования",
    "Usage totals loaded.": "Статистика использования загружена.",
    "Usage unavailable.": "Статистика использования недоступна.",
    "Loading workflows": "Загрузка workflows",
    "Loaded %@ workflows.": "Загружено workflows: %@.",
    "Creating workflow": "Создание workflow",
    "Saving workflow": "Сохранение workflow",
    "%@ saved.": "%@ сохранено.",
    "Removing workflow": "Удаление workflow",
    "Workflow removed.": "Workflow удален.",
    "Preparing workflow launch command": "Подготовка команды запуска workflow",
    "Workflow launch command prepared.": "Команда запуска workflow подготовлена.",
    "Workflow cannot run while assigned skills are unavailable on this host/profile.": "Workflow нельзя запустить, пока назначенные навыки недоступны на этом хосте/профиле.",
    "Select a workflow before saving.": "Выберите workflow перед сохранением.",
    "Loading skills": "Загрузка навыков",
    "Loaded %@ skills.": "Загружено навыков: %@.",
    "Loading skill detail": "Загрузка деталей навыка",
    "Creating skill": "Создание навыка",
    "Saving skill": "Сохранение навыка",
    "Loaded %@.": "Загружено %@.",
    "Discard unsaved skill edits?": "Сбросить несохраненные правки навыка?",
    "Select a skill before saving.": "Выберите навык перед сохранением.",
    "Loading cron jobs": "Загрузка cron-заданий",
    "Loaded %@ cron jobs.": "Загружено cron-заданий: %@.",
    "Creating cron job": "Создание cron-задания",
    "Saving cron job": "Сохранение cron-задания",
    "Cron job saved.": "Cron-задание сохранено.",
    "Running cron job": "Запуск cron-задания",
    "Cron job started.": "Cron-задание запущено.",
    "Resuming cron job": "Возобновление cron-задания",
    "Pausing cron job": "Приостановка cron-задания",
    "Cron job resumed.": "Cron-задание возобновлено.",
    "Cron job paused.": "Cron-задание приостановлено.",
    "Removing cron job": "Удаление cron-задания",
    "Cron job removed.": "Cron-задание удалено.",
    "Loading Kanban": "Загрузка Kanban",
    "Loaded %@ Kanban tasks.": "Загружено задач Kanban: %@.",
    "Loading Kanban task": "Загрузка задачи Kanban",
    "Creating Kanban board": "Создание Kanban-доски",
    "Kanban board created.": "Kanban-доска создана.",
    "Saving Kanban task": "Сохранение задачи Kanban",
    "Kanban task saved.": "Задача Kanban сохранена.",
    "Comment text is required.": "Нужен текст комментария.",
    "Recovery result is required.": "Нужен результат восстановления.",
    "Recovery metadata must be a JSON object.": "Метаданные восстановления должны быть JSON-объектом.",
    "Adding Kanban comment": "Добавление комментария Kanban",
    "Assigning Kanban task": "Назначение задачи Kanban",
    "Saving Kanban parents": "Сохранение родительских задач Kanban",
    "Saving Kanban children": "Сохранение дочерних задач Kanban",
    "Specifying Kanban task": "Уточнение задачи Kanban",
    "Blocking Kanban task": "Блокировка задачи Kanban",
    "Unblocking Kanban task": "Разблокировка задачи Kanban",
    "Completing Kanban task": "Завершение задачи Kanban",
    "Reclaiming Kanban task": "Возврат задачи Kanban",
    "Reassigning Kanban task": "Переназначение задачи Kanban",
    "Editing Kanban result": "Редактирование результата Kanban",
    "Updating Kanban home subscription": "Обновление подписки Kanban home",
    "Deleting Kanban task": "Удаление задачи Kanban",
    "Archiving Kanban task": "Архивация задачи Kanban",
    "Kanban task updated.": "Задача Kanban обновлена.",
    "Nudging Kanban dispatcher": "Запуск диспетчера Kanban",
    "Archiving Kanban board": "Архивация Kanban-доски",
    "Kanban board archived.": "Kanban-доска архивирована.",
    "Loading remote file": "Загрузка удаленного файла",
    "Saving remote file": "Сохранение удаленного файла",
    "Reload the file before saving.": "Перезагрузите файл перед сохранением.",
    "Local edits discarded.": "Локальные правки сброшены.",
    "Browsing remote files": "Просмотр удаленных файлов",
    "%@ remote items.": "Удаленных элементов: %@.",
    "%@ added to Workspace Files.": "%@ добавлен в Workspace Files.",
    "Bookmark removed.": "Закладка удалена.",
    "Loading sessions": "Загрузка сеансов",
    "Loading more sessions": "Загрузка дополнительных сеансов",
    "Loaded %@ of %@ sessions.": "Загружено сеансов: %@ из %@.",
    "Loading transcript": "Загрузка transcript",
    "Loaded %@ transcript messages.": "Загружено сообщений transcript: %@.",
    "Sending prompt to Hermes": "Отправка prompt в Hermes",
    "Prompt sent.": "Prompt отправлен.",
    "Session pinned.": "Сеанс закреплен.",
    "Session unpinned.": "Сеанс откреплен.",
    "Terminal resume command prepared.": "Команда resume для терминала подготовлена.",
    "Deleting session": "Удаление сеанса",
    "Session deleted.": "Сеанс удален.",
    "Port must be a positive number.": "Порт должен быть положительным числом.",
    "Port must be 65535 or lower.": "Порт должен быть не больше 65535.",
    "Discard unsaved Workspace Files edits before leaving Files?": "Сбросить несохраненные правки Workspace Files перед выходом из Files?",
    "Discard unsaved Workspace Files edits before switching the active host?": "Сбросить несохраненные правки Workspace Files перед сменой активного хоста?",
    "Delete connection \"%@\"?": "Удалить подключение \"%@\"?",
    "Remove workflow \"%@\"?": "Удалить workflow \"%@\"?",
    "Remove cron job \"%@\"?": "Удалить cron-задание \"%@\"?",
    "Delete Kanban task \"%@\"?": "Удалить задачу Kanban \"%@\"?",
    "Archive Kanban board \"%@\"?": "Архивировать Kanban-доску \"%@\"?",
    "Discard unsaved edits in the current file?": "Сбросить несохраненные правки в текущем файле?",
    "Remove bookmark \"%@\"? The remote file stays untouched.": "Удалить закладку \"%@\"? Удаленный файл останется без изменений.",
    "Delete remote session \"%@\"?": "Удалить удаленный сеанс \"%@\"?",
    "Theme updated.": "Тема обновлена.",
    "Switch to light mode": "Переключить на светлую тему",
    "Switch to dark mode": "Переключить на темную тему",
    "Switch to blue theme": "Переключить на голубую тему",
    "Switch to dark blue theme": "Переключить на темно-голубую тему",
    "Switch to outline theme": "Переключить на контурную тему",
    "Choose theme": "Выбрать тему",
    Light: "Светлая",
    Dark: "Темная",
    Blue: "Голубая",
    DarkBlue: "DarkBlue",
    Outline: "Контурная",
    Connection: "Подключение",
    "New connection": "Новое подключение",
    "New Connection": "Новое подключение",
    "Saved Hosts": "Сохраненные хосты",
    "No connections saved yet.": "Пока нет сохраненных подключений.",
    Delete: "Удалить",
    Name: "Имя",
    "SSH alias": "SSH-псевдоним",
    "Host or IP": "Host or IP",
    User: "User",
    Port: "Порт",
    "Hermes profile": "Профиль Hermes",
    "Custom Hermes home": "Пользовательская домашняя папка Hermes",
    Test: "Проверить",
    Save: "Сохранить",
    "Use Host": "Использовать хост",
    "Search workflows": "Поиск workflows",
    "New Workflow": "Новый workflow",
    "Workflow Details": "Детали workflow",
    Prompt: "Prompt",
    "Assigned Skills": "Назначенные навыки",
    "No discovered skills available.": "Доступные навыки не найдены.",
    "Loading skills...": "Загрузка навыков...",
    Remove: "Удалить",
    "Launch Command": "Команда запуска",
    "Run Terminal": "Запустить терминал",
    "Run Chat": "Запустить чат",
    Cancel: "Отмена",
    Create: "Создать",
    "New Tab": "Новая вкладка",
    "New Shell": "Новая оболочка",
    "Saved Workflows": "Сохраненные workflow",
    "Refresh Workflows": "Обновить workflows",
    "Loading workflows...": "Загрузка workflows...",
    "No matching workflows.": "Подходящих workflows нет.",
    "No workflows saved.": "Сохраненных workflows нет.",
    "Select a workflow": "Выберите workflow",
    "Choose a preset or create a new one for this host/profile.": "Выберите пресет или создайте новый для этого хоста/профиля.",
    "This workflow references skills that are unavailable on the active host/profile: %@": "Этот workflow ссылается на навыки, недоступные на активном хосте/профиле: %@",
    "No skills assigned.": "Навыки не назначены.",
    "Terminal Launch Command": "Команда запуска терминала",
    "Terminal Initial Input": "Начальный ввод терминала",
    "Terminal SSH startup command": "Стартовая SSH-команда терминала",
    "Chat Launch Command": "Команда запуска чата",
    "Chat Initial Input": "Начальный ввод чата",
    "Chat SSH startup command": "Стартовая SSH-команда чата",
    "(empty)": "(пусто)",
    "Local preset for the active host/profile": "Локальный пресет для активного хоста/профиля",
    Available: "Доступно",
    "Terminal theme": "Тема терминала",
    "No terminal tabs": "Нет вкладок терминала",
    "No terminal tab": "Нет вкладки терминала",
    "Select a connection first": "Сначала выберите подключение",
    "Terminal tabs run on the active Hermes host over SSH.": "Вкладки терминала запускаются на активном хосте Hermes через SSH.",
    "Create a tab to start Hermes Chat TUI.": "Создайте вкладку, чтобы запустить Hermes Chat TUI.",
    "Create a shell tab to work on the active SSH host.": "Создайте shell-вкладку для работы на активном SSH-хосте.",
    "Starting SSH terminal session...": "Запуск SSH-терминала...",
    "Terminal exited with code %@.": "Терминал завершился с кодом %@.",
    "Connected. Waiting for terminal output...": "Подключено. Ожидание вывода терминала...",
    "Create a tab to start a live SSH shell.": "Создайте вкладку, чтобы запустить live SSH shell.",
    "Command Runner": "Запуск команд",
    "Run Once": "Разовый запуск",
    Clear: "Очистить",
    Running: "Выполняется",
    "Run Command": "Выполнить команду",
    "Hermes Version": "Версия Hermes",
    "List Directory": "Список папки",
    "Hermes Chat": "Hermes Chat",
    "No command output yet": "Вывода команд пока нет",
    "Run a one-shot command to capture stdout, stderr, and exit code.": "Выполните разовую команду, чтобы получить stdout, stderr и код выхода.",
    Reconnect: "Переподключить",
    Stop: "Остановить",
    "Startup command": "Стартовая команда",
    "Initial input sent": "Начальный ввод отправлен",
    "Initial input pending": "Начальный ввод ожидает отправки",
    "Paste Again": "Вставить снова",
    "Type a command or raw input": "Введите команду или raw input",
    Send: "Отправить",
    Rerun: "Повторить",
    "Command produced no output.": "Команда не вывела данных.",
    "Loading Kanban...": "Загрузка Kanban...",
    "Saving Kanban board...": "Сохранение Kanban-доски...",
    "Dispatching Kanban...": "Запуск диспетчера Kanban...",
    "Saving Kanban task...": "Сохранение задачи Kanban...",
    "Starting terminal session...": "Запуск терминальной сессии...",
  },
  "zh-Hans": {
    "Hermes Desktop": "Hermes Desktop",
    Language: "语言",
    Updates: "更新",
    Checking: "检查中",
    "Check for updates": "检查更新",
    "Auto checks": "自动检查",
    "Open Release": "打开版本",
    Dismiss: "关闭",
    "Create or select an SSH profile to start.": "创建或选择 SSH 配置以开始。",
    "Unknown error.": "未知错误。",
    "Network request failed. Check your connection and try again.": "网络请求失败。请检查连接后重试。",
    "No active Hermes host": "没有活跃的 Hermes 主机",
    "Loading workspace": "正在加载工作区",
    "Saving connection": "正在保存连接",
    "Connection saved.": "连接已保存。",
    "Testing SSH connection": "正在测试 SSH 连接",
    "SSH OK: %@": "SSH 正常：%@",
    "Selecting host": "正在选择主机",
    "Active host selected.": "活跃主机已选择。",
    "Deleting connection": "正在删除连接",
    "Connection deleted.": "连接已删除。",
    "Refreshing remote workspace": "正在刷新远端工作区",
    "Connected to %@": "已连接到 %@",
    "Language updated.": "语言已更新。",
    "Automatic update checks enabled.": "自动更新检查已启用。",
    "Automatic update checks disabled.": "自动更新检查已停用。",
    "Checking for Hermes Desktop updates...": "正在检查 Hermes Desktop 更新...",
    "Hermes Desktop %@ is up to date.": "Hermes Desktop %@ 已是最新。",
    "Opening Hermes Desktop %@ release.": "正在打开 Hermes Desktop %@ 版本。",
    "Terminal output cleared.": "终端输出已清除。",
    "Terminal tab opened.": "终端标签页已打开。",
    "Terminal tab closed.": "终端标签页已关闭。",
    "Terminal command is required.": "需要终端命令。",
    "Terminal control sequence ignored.": "已忽略终端控制序列。",
    "Running terminal command": "正在运行终端命令",
    "Terminal command exited with code %@.": "终端命令已退出，代码 %@。",
    "Starting terminal session": "正在启动终端会话",
    "Opening workflow in Terminal": "正在终端中打开 workflow",
    "Opening workflow in Chat": "正在聊天中打开 workflow",
    "Opening session in Terminal": "正在终端中打开会话",
    "Opening %@ in Terminal.": "正在终端中打开 %@。",
    "Opening %@ in Chat.": "正在聊天中打开 %@。",
    "Loading usage totals": "正在加载使用统计",
    "Usage totals loaded.": "使用统计已加载。",
    "Usage unavailable.": "使用统计不可用。",
    "Loading workflows": "正在加载 workflows",
    "Loaded %@ workflows.": "已加载 %@ 个 workflows。",
    "Creating workflow": "正在创建 workflow",
    "Saving workflow": "正在保存 workflow",
    "%@ saved.": "%@ 已保存。",
    "Removing workflow": "正在移除 workflow",
    "Workflow removed.": "Workflow 已移除。",
    "Preparing workflow launch command": "正在准备 workflow 启动命令",
    "Workflow launch command prepared.": "Workflow 启动命令已准备。",
    "Workflow cannot run while assigned skills are unavailable on this host/profile.": "分配的技能在当前主机/配置上不可用，无法运行 workflow。",
    "Select a workflow before saving.": "保存前请选择 workflow。",
    "Loading skills": "正在加载技能",
    "Loaded %@ skills.": "已加载 %@ 个技能。",
    "Loading skill detail": "正在加载技能详情",
    "Creating skill": "正在创建技能",
    "Saving skill": "正在保存技能",
    "Loaded %@.": "已加载 %@。",
    "Discard unsaved skill edits?": "放弃未保存的技能编辑？",
    "Select a skill before saving.": "保存前请选择技能。",
    "Loading cron jobs": "正在加载 cron 任务",
    "Loaded %@ cron jobs.": "已加载 %@ 个 cron 任务。",
    "Creating cron job": "正在创建 cron 任务",
    "Saving cron job": "正在保存 cron 任务",
    "Cron job saved.": "Cron 任务已保存。",
    "Running cron job": "正在运行 cron 任务",
    "Cron job started.": "Cron 任务已启动。",
    "Resuming cron job": "正在恢复 cron 任务",
    "Pausing cron job": "正在暂停 cron 任务",
    "Cron job resumed.": "Cron 任务已恢复。",
    "Cron job paused.": "Cron 任务已暂停。",
    "Removing cron job": "正在移除 cron 任务",
    "Cron job removed.": "Cron 任务已移除。",
    "Loading Kanban": "正在加载 Kanban",
    "Loaded %@ Kanban tasks.": "已加载 %@ 个 Kanban 任务。",
    "Loading Kanban task": "正在加载 Kanban 任务",
    "Creating Kanban board": "正在创建 Kanban 看板",
    "Kanban board created.": "Kanban 看板已创建。",
    "Saving Kanban task": "正在保存 Kanban 任务",
    "Kanban task saved.": "Kanban 任务已保存。",
    "Comment text is required.": "需要评论文本。",
    "Recovery result is required.": "需要恢复结果。",
    "Recovery metadata must be a JSON object.": "恢复元数据必须是 JSON 对象。",
    "Adding Kanban comment": "正在添加 Kanban 评论",
    "Assigning Kanban task": "正在分配 Kanban 任务",
    "Saving Kanban parents": "正在保存 Kanban 父任务",
    "Saving Kanban children": "正在保存 Kanban 子任务",
    "Specifying Kanban task": "正在指定 Kanban 任务",
    "Blocking Kanban task": "正在阻塞 Kanban 任务",
    "Unblocking Kanban task": "正在解除 Kanban 阻塞",
    "Completing Kanban task": "正在完成 Kanban 任务",
    "Reclaiming Kanban task": "正在收回 Kanban 任务",
    "Reassigning Kanban task": "正在重新分配 Kanban 任务",
    "Editing Kanban result": "正在编辑 Kanban 结果",
    "Updating Kanban home subscription": "正在更新 Kanban home 订阅",
    "Deleting Kanban task": "正在删除 Kanban 任务",
    "Archiving Kanban task": "正在归档 Kanban 任务",
    "Kanban task updated.": "Kanban 任务已更新。",
    "Nudging Kanban dispatcher": "正在触发 Kanban 调度器",
    "Archiving Kanban board": "正在归档 Kanban 看板",
    "Kanban board archived.": "Kanban 看板已归档。",
    "Loading remote file": "正在加载远端文件",
    "Saving remote file": "正在保存远端文件",
    "Reload the file before saving.": "保存前请重新加载文件。",
    "Local edits discarded.": "本地编辑已放弃。",
    "Browsing remote files": "正在浏览远端文件",
    "%@ remote items.": "%@ 个远端项目。",
    "%@ added to Workspace Files.": "%@ 已添加到工作区文件。",
    "Bookmark removed.": "书签已移除。",
    "Loading sessions": "正在加载会话",
    "Loading more sessions": "正在加载更多会话",
    "Loaded %@ of %@ sessions.": "已加载 %@ / %@ 个会话。",
    "Loading transcript": "正在加载 transcript",
    "Loaded %@ transcript messages.": "已加载 %@ 条 transcript 消息。",
    "Sending prompt to Hermes": "正在向 Hermes 发送 prompt",
    "Prompt sent.": "Prompt 已发送。",
    "Session pinned.": "会话已置顶。",
    "Session unpinned.": "会话已取消置顶。",
    "Terminal resume command prepared.": "终端 resume 命令已准备。",
    "Deleting session": "正在删除会话",
    "Session deleted.": "会话已删除。",
    "Port must be a positive number.": "端口必须是正数。",
    "Port must be 65535 or lower.": "端口必须不大于 65535。",
    "Discard unsaved Workspace Files edits before leaving Files?": "离开 Files 前放弃未保存的 Workspace Files 编辑？",
    "Discard unsaved Workspace Files edits before switching the active host?": "切换活跃主机前放弃未保存的 Workspace Files 编辑？",
    "Delete connection \"%@\"?": "删除连接 \"%@\"？",
    "Remove workflow \"%@\"?": "移除 workflow \"%@\"？",
    "Remove cron job \"%@\"?": "移除 cron 任务 \"%@\"？",
    "Delete Kanban task \"%@\"?": "删除 Kanban 任务 \"%@\"？",
    "Archive Kanban board \"%@\"?": "归档 Kanban 看板 \"%@\"？",
    "Discard unsaved edits in the current file?": "放弃当前文件中未保存的编辑？",
    "Remove bookmark \"%@\"? The remote file stays untouched.": "移除书签 \"%@\"？远端文件不会被更改。",
    "Delete remote session \"%@\"?": "删除远端会话 \"%@\"？",
    "Theme updated.": "主题已更新。",
    "Switch to light mode": "切换到浅色模式",
    "Switch to dark mode": "切换到深色模式",
    "Switch to blue theme": "切换到蓝色主题",
    "Switch to dark blue theme": "切换到深蓝主题",
    "Switch to outline theme": "切换到轮廓主题",
    "Choose theme": "选择主题",
    Light: "浅色",
    Dark: "深色",
    Blue: "蓝色",
    DarkBlue: "深蓝",
    Outline: "轮廓",
    Connection: "连接",
    "New connection": "新建连接",
    "New Connection": "新建连接",
    "Saved Hosts": "已保存主机",
    "No connections saved yet.": "尚未保存连接。",
    Delete: "删除",
    Name: "名称",
    "SSH alias": "SSH 别名",
    "Host or IP": "主机或 IP",
    User: "用户",
    Port: "端口",
    "Hermes profile": "Hermes 配置",
    "Custom Hermes home": "自定义 Hermes home",
    Test: "测试",
    Save: "保存",
    "Use Host": "使用主机",
    "Search workflows": "搜索 workflows",
    "New Workflow": "新建 workflow",
    "Workflow Details": "Workflow 详情",
    Prompt: "Prompt",
    "Assigned Skills": "已分配技能",
    "No discovered skills available.": "没有发现可用技能。",
    "Loading skills...": "正在加载技能...",
    Remove: "移除",
    "Launch Command": "启动命令",
    "Run Terminal": "运行终端",
    "Run Chat": "运行聊天",
    Cancel: "取消",
    Create: "创建",
    "New Tab": "新建标签页",
    "New Shell": "新建 Shell",
    "Saved Workflows": "已保存 workflows",
    "Refresh Workflows": "刷新 workflows",
    "Loading workflows...": "正在加载 workflows...",
    "No matching workflows.": "没有匹配的 workflows。",
    "No workflows saved.": "尚未保存 workflows。",
    "Select a workflow": "选择 workflow",
    "Choose a preset or create a new one for this host/profile.": "选择预设，或为此主机/配置创建新的预设。",
    "This workflow references skills that are unavailable on the active host/profile: %@": "此 workflow 引用了当前主机/配置不可用的技能：%@",
    "No skills assigned.": "未分配技能。",
    "Terminal Launch Command": "终端启动命令",
    "Terminal Initial Input": "终端初始输入",
    "Terminal SSH startup command": "终端 SSH 启动命令",
    "Chat Launch Command": "聊天启动命令",
    "Chat Initial Input": "聊天初始输入",
    "Chat SSH startup command": "聊天 SSH 启动命令",
    "(empty)": "（空）",
    "Local preset for the active host/profile": "当前主机/配置的本地预设",
    Available: "可用",
    "Terminal theme": "终端主题",
    "No terminal tabs": "没有终端标签页",
    "No terminal tab": "没有终端标签页",
    "Select a connection first": "请先选择连接",
    "Terminal tabs run on the active Hermes host over SSH.": "终端标签页通过 SSH 在当前 Hermes 主机上运行。",
    "Create a tab to start Hermes Chat TUI.": "创建标签页以启动 Hermes Chat TUI。",
    "Create a shell tab to work on the active SSH host.": "创建 Shell 标签页以在当前 SSH 主机上工作。",
    "Starting SSH terminal session...": "正在启动 SSH 终端会话...",
    "Terminal exited with code %@.": "终端已退出，代码 %@。",
    "Connected. Waiting for terminal output...": "已连接。正在等待终端输出...",
    "Create a tab to start a live SSH shell.": "创建标签页以启动实时 SSH shell。",
    "Command Runner": "命令运行器",
    "Run Once": "单次运行",
    Clear: "清空",
    Running: "运行中",
    "Run Command": "运行命令",
    "Hermes Version": "Hermes 版本",
    "List Directory": "列出目录",
    "Hermes Chat": "Hermes 聊天",
    "No command output yet": "尚无命令输出",
    "Run a one-shot command to capture stdout, stderr, and exit code.": "运行一次性命令以捕获 stdout、stderr 和退出代码。",
    Reconnect: "重新连接",
    Stop: "停止",
    "Startup command": "启动命令",
    "Initial input sent": "初始输入已发送",
    "Initial input pending": "初始输入待发送",
    "Paste Again": "再次粘贴",
    "Type a command or raw input": "输入命令或原始输入",
    Send: "发送",
    Rerun: "重新运行",
    "Command produced no output.": "命令没有输出。",
    "Loading Kanban...": "正在加载 Kanban...",
    "Saving Kanban board...": "正在保存 Kanban 看板...",
    "Dispatching Kanban...": "正在调度 Kanban...",
    "Saving Kanban task...": "正在保存 Kanban 任务...",
    "Starting terminal session...": "正在启动终端会话...",
  },
};

for (const locale of appLocales.map((item) => item.id)) {
  for (const [key, value] of Object.entries(overlayTranslations[locale])) {
    dictionaries[locale].set(key, value);
  }
}

let activeLocale: AppLocale = "en";

export function setLocale(locale: string | null | undefined) {
  activeLocale = resolveLocale(locale);
  document.documentElement.lang = activeLocale;
}

export function currentLocale() {
  return activeLocale;
}

export function resolveLocale(locale: string | null | undefined): AppLocale {
  const normalized = locale?.trim();
  if (normalized === "ru" || normalized?.toLowerCase().startsWith("ru-")) {
    return "ru";
  }
  if (
    normalized === "zh-Hans" ||
    normalized === "zh" ||
    normalized?.toLowerCase().startsWith("zh-cn") ||
    normalized?.toLowerCase().startsWith("zh-hans")
  ) {
    return "zh-Hans";
  }
  return "en";
}

export function browserLocale() {
  return resolveLocale(navigator.languages?.[0] ?? navigator.language);
}

export function t(key: string) {
  return localizeString(key);
}

export function tf(key: string, ...values: Array<string | number>) {
  return formatLocalized(t(key), values);
}

export function localizeElement(root: ParentNode) {
  translateTextNodes(root);
  translateAttributes(root);
}

function translateTextNodes(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || shouldSkipElement(parent)) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }

  for (const node of nodes) {
    const value = node.textContent ?? "";
    const trimmed = value.trim();
    const translated = localizeString(trimmed);
    if (translated === trimmed) {
      continue;
    }
    const leading = value.match(/^\s*/)?.[0] ?? "";
    const trailing = value.match(/\s*$/)?.[0] ?? "";
    node.textContent = `${leading}${translated}${trailing}`;
  }
}

function translateAttributes(root: ParentNode) {
  const elements = root instanceof Element ? [root, ...root.querySelectorAll<HTMLElement>("*")] : [...root.querySelectorAll<HTMLElement>("*")];
  const attributes = ["title", "placeholder", "aria-label"];
  for (const element of elements) {
    if (shouldSkipElement(element)) {
      continue;
    }
    for (const attribute of attributes) {
      const value = element.getAttribute(attribute);
      if (!value) {
        continue;
      }
      const translated = localizeString(value.trim());
      if (translated !== value) {
        element.setAttribute(attribute, translated);
      }
    }
  }
}

function shouldSkipElement(element: Element) {
  return Boolean(element.closest("[data-no-localize], pre, code, textarea, script, style"));
}

function parseStrings(raw: string) {
  const map = new Map<string, string>();
  const expression = /"((?:\\.|[^"\\])*)"\s*=\s*"((?:\\.|[^"\\])*)";/g;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(raw)) !== null) {
    map.set(unescapeStringsValue(match[1]), unescapeStringsValue(match[2]));
  }
  return map;
}

function unescapeStringsValue(value: string) {
  return value
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\r")
    .replaceAll("\\t", "\t")
    .replaceAll('\\"', '"')
    .replaceAll("\\\\", "\\");
}

function localizeString(key: string) {
  const exact = dictionaries[activeLocale].get(key) ?? dictionaries.en.get(key);
  if (exact) {
    return exact;
  }
  return localizeFormattedString(key) ?? key;
}

function localizeFormattedString(value: string) {
  const english = dictionaries.en;
  for (const key of english.keys()) {
    if (!key.includes("%@")) {
      continue;
    }
    const args = matchFormattedKey(key, value);
    if (!args) {
      continue;
    }
    return formatLocalized(dictionaries[activeLocale].get(key) ?? key, args);
  }
  return null;
}

function matchFormattedKey(key: string, value: string) {
  const parts = key.split("%@").map(escapeRegExp);
  const pattern = new RegExp(`^${parts.join("(.+?)")}$`);
  const match = value.match(pattern);
  return match ? match.slice(1) : null;
}

function formatLocalized(template: string, values: Array<string | number>) {
  let index = 0;
  return template.replace(/%@/g, () => String(values[index++] ?? ""));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
