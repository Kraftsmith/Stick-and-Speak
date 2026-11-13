// The parent's account on screen (Specs/features/cloud-sync.md 3, startup.md 3.3): the sign-in, the Account block of
// the parent zone, "Found progress" and "Who are these children?". Text only, for the grown-up, never spoken; the
// language is the language of the instructions. What happens behind these screens is cloud.js.
import { Cloud } from './cloud.js';
import { Profiles } from './profiles.js';
import { S, save, profileId, profileCards, avatarPic, deviceLang, LANGS } from './state.js';
import { toDoc, countsOf } from './doc.js';
import { isNative, CAP } from './platform.js';
import { esc } from './util.js';

/* ================= texts ================= */
const T = {
  en: { account: 'Account', intro: 'Sign in to save the progress and move it to another device.', apple: 'Sign in with Apple', google: 'Google', email: 'E-mail',
    emailPh: 'E-mail address', send: 'Send the code', codeAsk: 'The 6 digits from the letter sent to', ok: 'Sign in', back: 'Back', again: 'Send again',
    same: 'To find the progress on another device, always sign in the same way.',
    noNet: 'No connection. Try again later.', noNetFirst: 'No connection. You can start without signing in — the progress can be connected later in the parent zone.',
    badCode: 'The code does not fit. Check it or ask for a new one.', badEmail: 'Check the address.', often: 'Too many attempts. Try again in a minute.',
    saved: 'Progress saved', notYet: 'Signed in · nothing saved yet', saving: 'Saving…', offline: 'No connection · last saved', never: 'never',
    relogin: 'Please sign in again', update: 'Update the app to keep saving the progress', finish: 'The sign-in is not finished', cont: 'Continue',
    out: 'Sign out', del: 'Delete account', cancel: 'Cancel',
    outAsk: 'The progress stays on this device but stops being saved to the cloud.',
    delAsk: 'The account and the progress of all children will be deleted from the cloud. The progress stays on this device. A store subscription is not cancelled — cancel it in the App Store / Google Play settings.',
    delWord: 'DELETE', delType: 'Type the word to confirm:',
    foundTitle: 'The account already has progress', inCloud: 'In the cloud', onDevice: 'On this device', updated: 'updated',
    take: 'Take from the cloud', keepNew: 'Keep this one as a new child', noSlot: 'No free place: an account holds 4 children.',
    takeNote: 'The progress on this device is put aside for 30 days.',
    counts: (w, s, a) => `${w} words · ${s} stickers · ${a} albums`,
    kidsTitle: 'Who are these children?', kidsNote: 'Names stay on this device. They are optional.', namePh: 'Name', done: 'Done' },
  ru: { account: 'Аккаунт', intro: 'Войдите, чтобы сохранить прогресс и перенести его на другое устройство.', apple: 'Войти через Apple', google: 'Google', email: 'E-mail',
    emailPh: 'Адрес e-mail', send: 'Отправить код', codeAsk: '6 цифр из письма, отправленного на', ok: 'Войти', back: 'Назад', again: 'Отправить ещё раз',
    same: 'Чтобы прогресс нашёлся на другом устройстве, входите одним и тем же способом.',
    noNet: 'Нет связи. Попробуйте позже.', noNetFirst: 'Нет связи. Можно начать без входа — прогресс подключится позже в родительской зоне.',
    badCode: 'Код не подошёл. Проверьте его или запросите новый.', badEmail: 'Проверьте адрес.', often: 'Слишком много попыток. Попробуйте через минуту.',
    saved: 'Прогресс сохранён', notYet: 'Вход выполнен · ещё ничего не сохранено', saving: 'Сохраняем…', offline: 'Нет связи · последнее сохранение', never: 'не было',
    relogin: 'Нужно войти заново', update: 'Обновите приложение, чтобы сохранять прогресс', finish: 'Вход не завершён', cont: 'Продолжить',
    out: 'Выйти', del: 'Удалить аккаунт', cancel: 'Отмена',
    outAsk: 'Прогресс останется на этом устройстве, но перестанет сохраняться в облако.',
    delAsk: 'Удалим аккаунт и прогресс всех детей из облака. На этом устройстве прогресс останется. Подписка из магазина не отменяется — отмените её в настройках App Store / Google Play.',
    delWord: 'УДАЛИТЬ', delType: 'Введите слово для подтверждения:',
    foundTitle: 'В аккаунте уже есть прогресс', inCloud: 'В облаке', onDevice: 'На этом устройстве', updated: 'обновлено',
    take: 'Взять из облака', keepNew: 'Оставить этот как нового ребёнка', noSlot: 'Нет свободного места: в аккаунте до 4 детей.',
    takeNote: 'Прогресс с этого устройства отложим на 30 дней.',
    counts: (w, s, a) => `слов: ${w} · стикеров: ${s} · альбомов: ${a}`,
    kidsTitle: 'Кто эти дети?', kidsNote: 'Имена остаются на этом устройстве. Их можно не вводить.', namePh: 'Имя', done: 'Готово' },
  uk: { account: 'Акаунт', intro: 'Увійдіть, щоб зберегти прогрес і перенести його на інший пристрій.', apple: 'Увійти через Apple', google: 'Google', email: 'E-mail',
    emailPh: 'Адреса e-mail', send: 'Надіслати код', codeAsk: '6 цифр із листа, надісланого на', ok: 'Увійти', back: 'Назад', again: 'Надіслати ще раз',
    same: 'Щоб прогрес знайшовся на іншому пристрої, входьте тим самим способом.',
    noNet: 'Немає зв’язку. Спробуйте пізніше.', noNetFirst: 'Немає зв’язку. Можна почати без входу — прогрес підключиться пізніше в батьківській зоні.',
    badCode: 'Код не підійшов. Перевірте його або запросіть новий.', badEmail: 'Перевірте адресу.', often: 'Забагато спроб. Спробуйте за хвилину.',
    saved: 'Прогрес збережено', notYet: 'Вхід виконано · ще нічого не збережено', saving: 'Зберігаємо…', offline: 'Немає зв’язку · останнє збереження', never: 'не було',
    relogin: 'Потрібно увійти знову', update: 'Оновіть застосунок, щоб зберігати прогрес', finish: 'Вхід не завершено', cont: 'Продовжити',
    out: 'Вийти', del: 'Видалити акаунт', cancel: 'Скасувати',
    outAsk: 'Прогрес залишиться на цьому пристрої, але перестане зберігатися в хмару.',
    delAsk: 'Видалимо акаунт і прогрес усіх дітей із хмари. На цьому пристрої прогрес залишиться. Підписка з магазину не скасовується — скасуйте її в налаштуваннях App Store / Google Play.',
    delWord: 'ВИДАЛИТИ', delType: 'Введіть слово для підтвердження:',
    foundTitle: 'В акаунті вже є прогрес', inCloud: 'У хмарі', onDevice: 'На цьому пристрої', updated: 'оновлено',
    take: 'Взяти з хмари', keepNew: 'Залишити цей як нову дитину', noSlot: 'Немає вільного місця: в акаунті до 4 дітей.',
    takeNote: 'Прогрес із цього пристрою відкладемо на 30 днів.',
    counts: (w, s, a) => `слів: ${w} · стікерів: ${s} · альбомів: ${a}`,
    kidsTitle: 'Хто ці діти?', kidsNote: 'Імена залишаються на цьому пристрої. Їх можна не вводити.', namePh: 'Ім’я', done: 'Готово' },
  de: { account: 'Konto', intro: 'Melden Sie sich an, um den Fortschritt zu sichern und auf ein anderes Gerät zu übertragen.', apple: 'Mit Apple anmelden', google: 'Google', email: 'E-Mail',
    emailPh: 'E-Mail-Adresse', send: 'Code senden', codeAsk: 'Die 6 Ziffern aus der E-Mail an', ok: 'Anmelden', back: 'Zurück', again: 'Erneut senden',
    same: 'Damit der Fortschritt auf einem anderen Gerät gefunden wird, melden Sie sich immer auf dieselbe Weise an.',
    noNet: 'Keine Verbindung. Versuchen Sie es später.', noNetFirst: 'Keine Verbindung. Sie können ohne Anmeldung beginnen — der Fortschritt lässt sich später im Elternbereich verbinden.',
    badCode: 'Der Code passt nicht. Prüfen Sie ihn oder fordern Sie einen neuen an.', badEmail: 'Prüfen Sie die Adresse.', often: 'Zu viele Versuche. Versuchen Sie es in einer Minute.',
    saved: 'Fortschritt gesichert', notYet: 'Angemeldet · noch nichts gesichert', saving: 'Wird gesichert…', offline: 'Keine Verbindung · zuletzt gesichert', never: 'nie',
    relogin: 'Bitte erneut anmelden', update: 'Aktualisieren Sie die App, um den Fortschritt weiter zu sichern', finish: 'Die Anmeldung ist nicht abgeschlossen', cont: 'Weiter',
    out: 'Abmelden', del: 'Konto löschen', cancel: 'Abbrechen',
    outAsk: 'Der Fortschritt bleibt auf diesem Gerät, wird aber nicht mehr in der Cloud gesichert.',
    delAsk: 'Das Konto und der Fortschritt aller Kinder werden aus der Cloud gelöscht. Auf diesem Gerät bleibt der Fortschritt. Ein Abo aus dem Store wird nicht gekündigt — kündigen Sie es in den Einstellungen von App Store / Google Play.',
    delWord: 'LÖSCHEN', delType: 'Geben Sie das Wort zur Bestätigung ein:',
    foundTitle: 'Im Konto gibt es schon Fortschritt', inCloud: 'In der Cloud', onDevice: 'Auf diesem Gerät', updated: 'aktualisiert',
    take: 'Aus der Cloud nehmen', keepNew: 'Diesen als neues Kind behalten', noSlot: 'Kein freier Platz: ein Konto fasst 4 Kinder.',
    takeNote: 'Der Fortschritt dieses Geräts wird 30 Tage aufbewahrt.',
    counts: (w, s, a) => `Wörter: ${w} · Sticker: ${s} · Alben: ${a}`,
    kidsTitle: 'Wer sind diese Kinder?', kidsNote: 'Namen bleiben auf diesem Gerät. Sie sind freiwillig.', namePh: 'Name', done: 'Fertig' },
  fr: { account: 'Compte', intro: 'Connectez-vous pour sauvegarder la progression et la retrouver sur un autre appareil.', apple: 'Se connecter avec Apple', google: 'Google', email: 'E-mail',
    emailPh: 'Adresse e-mail', send: 'Envoyer le code', codeAsk: 'Les 6 chiffres de l’e-mail envoyé à', ok: 'Se connecter', back: 'Retour', again: 'Renvoyer',
    same: 'Pour retrouver la progression sur un autre appareil, connectez-vous toujours de la même façon.',
    noNet: 'Pas de connexion. Réessayez plus tard.', noNetFirst: 'Pas de connexion. Vous pouvez commencer sans vous connecter — la progression pourra être reliée plus tard dans l’espace parents.',
    badCode: 'Le code ne convient pas. Vérifiez-le ou demandez-en un nouveau.', badEmail: 'Vérifiez l’adresse.', often: 'Trop de tentatives. Réessayez dans une minute.',
    saved: 'Progression sauvegardée', notYet: 'Connecté · rien n’est encore sauvegardé', saving: 'Sauvegarde…', offline: 'Pas de connexion · dernière sauvegarde', never: 'jamais',
    relogin: 'Veuillez vous reconnecter', update: 'Mettez l’application à jour pour continuer à sauvegarder la progression', finish: 'La connexion n’est pas terminée', cont: 'Continuer',
    out: 'Se déconnecter', del: 'Supprimer le compte', cancel: 'Annuler',
    outAsk: 'La progression reste sur cet appareil mais n’est plus sauvegardée dans le cloud.',
    delAsk: 'Le compte et la progression de tous les enfants seront supprimés du cloud. La progression reste sur cet appareil. Un abonnement pris dans un store n’est pas annulé — annulez-le dans les réglages de l’App Store / Google Play.',
    delWord: 'SUPPRIMER', delType: 'Saisissez le mot pour confirmer :',
    foundTitle: 'Le compte contient déjà une progression', inCloud: 'Dans le cloud', onDevice: 'Sur cet appareil', updated: 'mis à jour',
    take: 'Prendre celle du cloud', keepNew: 'Garder celle-ci comme nouvel enfant', noSlot: 'Plus de place : un compte contient 4 enfants.',
    takeNote: 'La progression de cet appareil est mise de côté pendant 30 jours.',
    counts: (w, s, a) => `mots : ${w} · stickers : ${s} · albums : ${a}`,
    kidsTitle: 'Qui sont ces enfants ?', kidsNote: 'Les prénoms restent sur cet appareil. Ils sont facultatifs.', namePh: 'Prénom', done: 'Terminé' },
  es: { account: 'Cuenta', intro: 'Inicia sesión para guardar el progreso y pasarlo a otro dispositivo.', apple: 'Iniciar sesión con Apple', google: 'Google', email: 'E-mail',
    emailPh: 'Dirección de e-mail', send: 'Enviar el código', codeAsk: 'Los 6 dígitos del correo enviado a', ok: 'Entrar', back: 'Atrás', again: 'Enviar otra vez',
    same: 'Para encontrar el progreso en otro dispositivo, inicia sesión siempre de la misma forma.',
    noNet: 'Sin conexión. Inténtalo más tarde.', noNetFirst: 'Sin conexión. Puedes empezar sin iniciar sesión — el progreso se podrá conectar después en la zona de padres.',
    badCode: 'El código no coincide. Revísalo o pide uno nuevo.', badEmail: 'Revisa la dirección.', often: 'Demasiados intentos. Inténtalo en un minuto.',
    saved: 'Progreso guardado', notYet: 'Sesión iniciada · aún no se ha guardado nada', saving: 'Guardando…', offline: 'Sin conexión · último guardado', never: 'nunca',
    relogin: 'Inicia sesión de nuevo', update: 'Actualiza la aplicación para seguir guardando el progreso', finish: 'El inicio de sesión no ha terminado', cont: 'Continuar',
    out: 'Cerrar sesión', del: 'Eliminar la cuenta', cancel: 'Cancelar',
    outAsk: 'El progreso se queda en este dispositivo, pero deja de guardarse en la nube.',
    delAsk: 'Se eliminarán de la nube la cuenta y el progreso de todos los niños. En este dispositivo el progreso se queda. La suscripción de la tienda no se cancela — cancélala en los ajustes de App Store / Google Play.',
    delWord: 'ELIMINAR', delType: 'Escribe la palabra para confirmar:',
    foundTitle: 'La cuenta ya tiene progreso', inCloud: 'En la nube', onDevice: 'En este dispositivo', updated: 'actualizado',
    take: 'Tomar el de la nube', keepNew: 'Dejar este como un niño nuevo', noSlot: 'No hay sitio: una cuenta admite 4 niños.',
    takeNote: 'El progreso de este dispositivo se guarda aparte durante 30 días.',
    counts: (w, s, a) => `palabras: ${w} · stickers: ${s} · álbumes: ${a}`,
    kidsTitle: '¿Quiénes son estos niños?', kidsNote: 'Los nombres se quedan en este dispositivo. Son opcionales.', namePh: 'Nombre', done: 'Listo' },
};
const text = lang => T[lang] || T.en;
// "today 12:40", "13 Nov, 19:05" in the language of the screen
function when(ms, lang) {
  const d = new Date(ms), time = d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? time : d.toLocaleDateString(lang, { day: 'numeric', month: 'short' }) + ', ' + time;
}
const errText = (e, t, firstRun) => e.kind === 'network' || e.kind === 'server' ? (firstRun ? t.noNetFirst : t.noNet) : e.kind === 'often' ? t.often : e.kind === 'email' ? t.badEmail : t.badCode;
const isIOS = isNative ? CAP.getPlatform() === 'ios' : /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);

/* ================= the sign-in ================= */
// Draws the three ways to sign in into `el` and walks the parent through the e-mail code. `onDone(result)` gets what
// Cloud.link() found; `onBack`, if given, adds a "Back" line (the first run). While a request runs the buttons are off.
export function mountSignIn(el, { lang, firstRun = false, onDone, onBack }) {
  const t = text(lang);
  let mode = 'ways', email = '', err = '', busy = false, ways = null;
  const draw = () => {
    if (!ways) { el.innerHTML = ''; return; }   // the server has not said yet what it offers
    const off = busy ? 'disabled' : '';
    // Apple goes first on Apple devices (its rule when any other sign-in is offered), Google first elsewhere
    const order = (isIOS ? ['apple', 'google', 'email'] : ['google', 'apple', 'email']).filter(w => ways.includes(w));
    el.innerHTML = `<div class="signin ${busy ? 'busy' : ''}">${
      mode === 'ways' ? `<div class="sirow">${order.map(w => `<button data-way="${w}" ${off}>${w === 'email' ? '✉ ' + t.email : t[w]}</button>`).join('')}</div>
          ${order.length > 1 ? `<div class="sinote">${t.same}</div>` : ''}`
      : mode === 'email' ? `<div class="sirow"><input type="email" id="siEmail" placeholder="${t.emailPh}" value="${esc(email)}" autocomplete="email" ${off}>
          <button class="on" id="siSend" ${off}>${t.send}</button><button id="siBack" ${off}>${t.back}</button></div>`
      : `<div class="sinote">${t.codeAsk} <b>${esc(email)}</b></div>
          <div class="sirow"><input type="text" id="siCode" inputmode="numeric" maxlength="6" placeholder="······" autocomplete="one-time-code" ${off}>
          <button class="on" id="siOk" ${off}>${t.ok}</button><button id="siAgain" ${off}>${t.again}</button><button id="siBack" ${off}>${t.back}</button></div>`}
      ${err ? `<div class="sierr">${err}</div>` : ''}
      ${onBack && mode === 'ways' ? `<button class="silink" id="siLeave" ${off}>${t.back}</button>` : ''}</div>`;
    const on = (id, fn) => { const b = el.querySelector('#' + id); if (b) b.onclick = fn; };
    el.querySelectorAll('[data-way]').forEach(b => b.onclick = () => {
      err = '';
      if (b.dataset.way === 'email') { mode = 'email'; draw(); focus('siEmail'); } else run(() => Cloud.social(b.dataset.way));
    });
    on('siBack', () => { mode = mode === 'code' ? 'email' : 'ways'; err = ''; draw(); });
    on('siLeave', onBack);
    const send = () => { email = el.querySelector('#siEmail') ? el.querySelector('#siEmail').value.trim() : email;
      if (!/^\S+@\S+\.\S+$/.test(email)) { err = t.badEmail; return draw(); }
      run(async () => { await Cloud.sendCode(email); mode = 'code'; }, 'siCode'); };
    on('siSend', send); on('siAgain', send);
    const ok = () => { const code = el.querySelector('#siCode').value.replace(/\D/g, '');
      if (code.length !== 6) { err = t.badCode; return draw(); }
      run(async () => { const r = await Cloud.verifyCode(email, code); onDone(r); return true; }); };
    on('siOk', ok);
    const key = (id, fn) => { const i = el.querySelector('#' + id); if (i) i.onkeydown = ev => { if (ev.key === 'Enter') fn(); }; };
    key('siEmail', send); key('siCode', ok);
  };
  const focus = id => { const i = el.querySelector('#' + id); if (i) i.focus(); };
  // one request at a time; an error is one line under the buttons and nothing else changes
  async function run(fn, then) {
    busy = true; err = ''; draw();
    let left = false;
    try { left = await fn(); } catch (e) { err = errText(e, t, firstRun); }
    busy = false;
    if (!left && el.isConnected) { draw(); if (then) focus(then); }
  }
  draw();
  Cloud.providers().then(w => { ways = w; if (el.isConnected && mode === 'ways' && !busy) draw(); });
}

/* ================= the Account block of the parent zone ================= */
// `onJoined()` is called when the device joined an account or left it: the lists around the block have changed.
let mounted = null;
export function mountAccount(el, { onJoined }) {
  const lang = S.lang || deviceLang(), t = text(lang);
  let mode = 'idle', found = null, err = '', busy = false, ways = null;
  mounted = el;
  const joined = r => {
    if (r && r.step === 'found') { found = r; mode = 'found'; return draw(); }
    mode = 'idle'; found = null; onJoined(r || {});
  };
  const run = async fn => { busy = true; err = ''; draw(); try { await fn(); } catch (e) { err = errText(e, t); } busy = false; if (el.isConnected) draw(); };
  function draw() {
    const acc = Cloud.account(), st = Cloud.status(), off = busy ? 'disabled' : '';
    // no account and the server offers no way to sign in (or has not answered yet): the block is not shown
    if (!acc && !(ways && ways.length)) { el.innerHTML = ''; return; }
    let body;
    if (mode === 'found') body = foundHtml(found, t, lang, off);
    else if (!acc || mode === 'signin') body = `<div class="pnote">${t.intro}</div><div id="accIn"></div>`;
    else if (acc.pending) body = `<div class="accmail">${esc(acc.email)}</div><div class="accst warn">${t.finish} <button id="accCont" ${off}>${t.cont}</button></div>`;
    else if (mode === 'out') body = `<div class="accmail">${esc(acc.email)}</div><div class="pnote">${t.outAsk}</div>
      <div class="accbtns"><button class="on" id="accOutYes" ${off}>${t.out}</button><button id="accNo" ${off}>${t.cancel}</button></div>`;
    else if (mode === 'del') body = `<div class="accmail">${esc(acc.email)}</div><div class="pnote">${t.delAsk}</div>
      <div class="accbtns">${t.delType} <b>${t.delWord}</b> <input type="text" id="accWord" autocomplete="off" ${off}>
      <button class="pkdel" id="accDelYes" ${off}>${t.del}</button><button id="accNo" ${off}>${t.cancel}</button></div>`;
    else body = `<div class="accmail">${esc(acc.email)}</div>
      <div class="accst ${st.state}">${st.state === 'saved' ? (st.at ? `✓ ${t.saved} · ${when(st.at, lang)}` : t.notYet)
        : st.state === 'saving' ? `⟳ ${t.saving}`
        : st.state === 'offline' ? `${t.offline} ${st.at ? when(st.at, lang) : t.never}`
        : st.state === 'relogin' ? `${t.relogin} <button id="accRe">${t.ok}</button>` : t.update}</div>
      <div class="accbtns"><button id="accOut">${t.out}</button><button class="pkdel" id="accDel">${t.del}</button></div>`;
    el.innerHTML = `<div class="pkids pacc"><div class="ph">${t.account}</div>${body}${err ? `<div class="sierr">${err}</div>` : ''}</div>`;
    const on = (id, fn) => { const b = el.querySelector('#' + id); if (b) b.onclick = fn; };
    if (el.querySelector('#accIn')) mountSignIn(el.querySelector('#accIn'), { lang, onDone: joined });
    on('accRe', () => { mode = 'signin'; draw(); });
    on('accCont', () => run(async () => joined(await Cloud.link())));
    on('accOut', () => { mode = 'out'; draw(); });
    on('accDel', () => { mode = 'del'; draw(); });
    on('accNo', () => { mode = 'idle'; err = ''; draw(); });
    on('accOutYes', () => run(async () => { await Cloud.signOut(); mode = 'idle'; onJoined({}); }));
    on('accDelYes', () => {
      if (el.querySelector('#accWord').value.trim().toUpperCase() !== t.delWord) { el.querySelector('#accWord').focus(); return; }
      run(async () => { await Cloud.deleteAccount(); mode = 'idle'; onJoined({}); });
    });
    on('foundTake', () => joined(Cloud.choose('cloud')));
    on('foundKeep', () => joined(Cloud.choose('keep')));
  }
  draw();
  Cloud.providers().then(w => { ways = w; if (el.isConnected && mode === 'idle' && !busy) draw(); });
  mounted.redraw = () => { if (el.isConnected && (mode === 'idle') && !busy) draw(); };
}
// the lines of the block follow the sync: saving, saved, no connection
Cloud.onChange(() => { if (mounted && mounted.redraw) mounted.redraw(); });

// "Found progress" (cloud-sync.md 3.3): both the cloud and the device have progress, the parent chooses once
function foundHtml(f, t, lang, off) {
  const line = c => t.counts(c.words, c.stickers, c.albums);
  return `<div class="found"><b>${t.foundTitle}</b>
    <div class="frow"><span>● ${t.inCloud}:</span><span>${f.cloud.map(c => `${line(c)}<small>${t.updated} ${when(c.at, lang)}</small>`).join('<br>')}</span></div>
    <div class="frow"><span>● ${t.onDevice}:</span><span>${f.local.map(l => (l.name ? esc(l.name) + ' · ' : '') + line(l)).join('<br>')}</span></div>
    <div class="accbtns"><button class="on" id="foundTake" ${off}>${t.take}</button><button id="foundKeep" ${f.canKeep ? off : 'disabled'}>${t.keepNew}</button></div>
    <div class="pnote">${t.takeNote}${f.canKeep ? '' : ' ' + t.noSlot}</div></div>`;
}

/* ================= "Who are these children?" ================= */
// After a sign-in on a device without profiles (startup.md 3.3): one row per child that came from the cloud, with the
// picture and the counters, a field for the name (the cloud has none) and the language of the instructions, already
// chosen as the child had it on the other device.
export function mountKids(el, ids, lang, onDone) {
  const t = text(lang);
  const kids = profileCards().filter(k => ids.includes(k.id)).map(k => {
    const { state } = Profiles.load(k.id);
    return { ...k, lang: LANGS.some(l => l[0] === state.lang) ? state.lang : deviceLang(), counts: countsOf(toDoc(state)) };
  });
  const draw = () => {
    el.innerHTML = `<div class="kidstep"><div class="frtitle">${t.kidsTitle}</div>
      ${kids.map((k, i) => `<div class="kidrow">
        <span class="kav">${avatarPic(k.avatar)}</span>
        <span class="kmid"><input type="text" data-i="${i}" maxlength="12" placeholder="${t.namePh}" value="${esc(k.name)}">
          <small>${t.counts(k.counts.words, k.counts.stickers, k.counts.albums)}</small></span>
        <span class="frlangs">${LANGS.map(([l, n]) => `<button data-i="${i}" data-l="${l}" class="${k.lang === l ? 'on' : ''}">${n}</button>`).join('')}</span>
      </div>`).join('')}
      <div class="sinote">${t.kidsNote}</div>
      <div class="frrow fract"><button class="btn orange" id="kidsDone">${t.done}</button></div></div>`;
    el.querySelectorAll('input[data-i]').forEach(i => i.oninput = () => { kids[+i.dataset.i].name = i.value.trim(); });
    el.querySelectorAll('button[data-l]').forEach(b => b.onclick = () => { kids[+b.dataset.i].lang = b.dataset.l; draw(); });
    el.querySelector('#kidsDone').onclick = () => {
      kids.forEach(k => {
        Profiles.setLocal(k.id, { kidName: k.name });
        if (k.id === profileId()) { S.kidName = k.name; S.lang = k.lang; save(); }
        else if (Profiles.load(k.id).state.lang !== k.lang) { Profiles.patch(k.id, { lang: k.lang }); Cloud.markDirty(k.id); }
      });
      onDone();
    };
  };
  draw();
}
