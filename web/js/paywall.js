// Premium on screen (Specs/features/subscription.md 4, 5): the "Unlock all" tab of the parent zone and the promo code
// of the first run. Text only, for the grown-up, never spoken, in the language of the instructions. A child never
// sees a price or the word "buy": these screens are behind the parent lock or on the first-run screen for the adult.
import { Premium, FREE, PLANS, promoAllowed } from './premium.js';
import { Cloud } from './cloud.js';
import { mountSignIn } from './account.js';
import { isNative } from './platform.js';
import { esc } from './util.js';

const T = {
  en: { tab: 'Unlock all',
    free: (d, n) => `Free plan: ${n} lessons and the first album. Lessons done: ${d} of ${n}.`,
    premium: d => `Premium is open until ${d}.`, forever: 'Premium is open for ever.', byCode: 'Opened with a promo code.',
    expired: d => `Premium ended on ${d}. Everything your child collected stays; new lessons and new stickers are locked.`,
    stale: 'Connect to the internet to confirm Premium.',
    what: 'Premium opens:', list: ['All lessons and levels', 'All albums and stickers', 'Up to 4 children', 'Everything we add later'],
    month: ['1 month', 'per month', ''], year: ['1 year', 'per year', 'Half the monthly price'], life: ['For ever', 'one payment', 'With everything we add later'],
    buyWeb: 'Premium is bought in the Stick & Play app for Android or iPhone. Sign in there with the same account and it opens here too.',
    buySoon: 'Purchases open when the app is released in the store.',
    promo: 'Promo code', ph: 'Code', apply: 'Apply', needAcc: 'A promo code is kept in the parent account. Sign in first.', toSettings: 'Sign in',
    ok: d => `The code is accepted. Premium is open until ${d}.`, okForever: 'The code is accepted. Premium is open for ever.',
    not_found: 'There is no such code. Check the letters.', expired_code: 'This code is no longer valid.', exhausted: 'This code has been used up.',
    already_used: 'This account has already used a promo code.', network: 'No connection. Try again later.', signin: 'Sign in first.',
    line: 'I have a promo code', intro: 'Enter the code, then sign in with your e-mail: the free months are kept in your account.',
    next: 'Next', back: 'Back', cont: 'Continue', without: 'Continue without a code' },
  ru: { tab: 'Открыть всё',
    free: (d, n) => `Бесплатный план: ${n} занятий и первый альбом. Пройдено занятий: ${d} из ${n}.`,
    premium: d => `Премиум открыт до ${d}.`, forever: 'Премиум открыт навсегда.', byCode: 'Открыт промокодом.',
    expired: d => `Премиум закончился ${d}. Всё, что ребёнок собрал, остаётся; новые занятия и новые стикеры закрыты.`,
    stale: 'Подключитесь к интернету, чтобы подтвердить Премиум.',
    what: 'Премиум открывает:', list: ['Все занятия и уровни', 'Все альбомы и стикеры', 'До 4 детей', 'Всё, что мы добавим позже'],
    month: ['1 месяц', 'в месяц', ''], year: ['1 год', 'в год', 'Вдвое дешевле месячного'], life: ['Навсегда', 'один платёж', 'Со всем, что мы добавим позже'],
    buyWeb: 'Премиум покупается в приложении Stick & Play для Android или iPhone. Войдите там в тот же аккаунт, и он откроется и здесь.',
    buySoon: 'Покупки откроются, когда приложение выйдет в магазине.',
    promo: 'Промокод', ph: 'Код', apply: 'Применить', needAcc: 'Промокод хранится в аккаунте родителя. Сначала войдите.', toSettings: 'Войти',
    ok: d => `Код принят. Премиум открыт до ${d}.`, okForever: 'Код принят. Премиум открыт навсегда.',
    not_found: 'Такого кода нет. Проверьте буквы.', expired_code: 'Этот код больше не действует.', exhausted: 'Этот код уже использован полностью.',
    already_used: 'Этот аккаунт уже использовал промокод.', network: 'Нет связи. Попробуйте позже.', signin: 'Сначала войдите.',
    line: 'У меня есть промокод', intro: 'Введите код, затем войдите по e-mail: бесплатные месяцы сохранятся в вашем аккаунте.',
    next: 'Далее', back: 'Назад', cont: 'Продолжить', without: 'Продолжить без кода' },
  uk: { tab: 'Відкрити все',
    free: (d, n) => `Безкоштовний план: ${n} занять і перший альбом. Пройдено занять: ${d} із ${n}.`,
    premium: d => `Преміум відкрито до ${d}.`, forever: 'Преміум відкрито назавжди.', byCode: 'Відкрито промокодом.',
    expired: d => `Преміум закінчився ${d}. Усе, що дитина зібрала, залишається; нові заняття й нові стікери закриті.`,
    stale: 'Підключіться до інтернету, щоб підтвердити Преміум.',
    what: 'Преміум відкриває:', list: ['Усі заняття й рівні', 'Усі альбоми й стікери', 'До 4 дітей', 'Усе, що ми додамо пізніше'],
    month: ['1 місяць', 'на місяць', ''], year: ['1 рік', 'на рік', 'Удвічі дешевше за місячний'], life: ['Назавжди', 'один платіж', 'З усім, що ми додамо пізніше'],
    buyWeb: 'Преміум купується в застосунку Stick & Play для Android або iPhone. Увійдіть там у той самий акаунт, і він відкриється й тут.',
    buySoon: 'Покупки відкриються, коли застосунок вийде в магазині.',
    promo: 'Промокод', ph: 'Код', apply: 'Застосувати', needAcc: 'Промокод зберігається в акаунті батьків. Спочатку увійдіть.', toSettings: 'Увійти',
    ok: d => `Код прийнято. Преміум відкрито до ${d}.`, okForever: 'Код прийнято. Преміум відкрито назавжди.',
    not_found: 'Такого коду немає. Перевірте літери.', expired_code: 'Цей код більше не діє.', exhausted: 'Цей код уже використано повністю.',
    already_used: 'Цей акаунт уже використав промокод.', network: 'Немає зв’язку. Спробуйте пізніше.', signin: 'Спочатку увійдіть.',
    line: 'У мене є промокод', intro: 'Введіть код, потім увійдіть через e-mail: безкоштовні місяці збережуться у вашому акаунті.',
    next: 'Далі', back: 'Назад', cont: 'Продовжити', without: 'Продовжити без коду' },
  de: { tab: 'Alles freischalten',
    free: (d, n) => `Kostenlos: ${n} Lektionen und das erste Album. Geschaffte Lektionen: ${d} von ${n}.`,
    premium: d => `Premium ist bis ${d} offen.`, forever: 'Premium ist für immer offen.', byCode: 'Mit einem Promo-Code geöffnet.',
    expired: d => `Premium endete am ${d}. Alles Gesammelte bleibt; neue Lektionen und neue Sticker sind gesperrt.`,
    stale: 'Verbinden Sie sich mit dem Internet, um Premium zu bestätigen.',
    what: 'Premium öffnet:', list: ['Alle Lektionen und Stufen', 'Alle Alben und Sticker', 'Bis zu 4 Kinder', 'Alles, was später dazukommt'],
    month: ['1 Monat', 'pro Monat', ''], year: ['1 Jahr', 'pro Jahr', 'Halb so teuer wie monatlich'], life: ['Für immer', 'einmalig', 'Mit allem, was später dazukommt'],
    buyWeb: 'Premium wird in der Stick & Play App für Android oder iPhone gekauft. Melden Sie sich dort mit demselben Konto an, dann ist es auch hier offen.',
    buySoon: 'Käufe sind möglich, sobald die App im Store erscheint.',
    promo: 'Promo-Code', ph: 'Code', apply: 'Einlösen', needAcc: 'Ein Promo-Code wird im Elternkonto gespeichert. Melden Sie sich zuerst an.', toSettings: 'Anmelden',
    ok: d => `Der Code ist angenommen. Premium ist bis ${d} offen.`, okForever: 'Der Code ist angenommen. Premium ist für immer offen.',
    not_found: 'Diesen Code gibt es nicht. Prüfen Sie die Buchstaben.', expired_code: 'Dieser Code gilt nicht mehr.', exhausted: 'Dieser Code ist aufgebraucht.',
    already_used: 'Dieses Konto hat schon einen Promo-Code eingelöst.', network: 'Keine Verbindung. Versuchen Sie es später.', signin: 'Melden Sie sich zuerst an.',
    line: 'Ich habe einen Promo-Code', intro: 'Geben Sie den Code ein und melden Sie sich dann per E-Mail an: die Gratismonate bleiben in Ihrem Konto.',
    next: 'Weiter', back: 'Zurück', cont: 'Weiter', without: 'Ohne Code weiter' },
  fr: { tab: 'Tout débloquer',
    free: (d, n) => `Gratuit : ${n} leçons et le premier album. Leçons terminées : ${d} sur ${n}.`,
    premium: d => `Premium est ouvert jusqu’au ${d}.`, forever: 'Premium est ouvert pour toujours.', byCode: 'Ouvert avec un code promo.',
    expired: d => `Premium s’est terminé le ${d}. Tout ce que l’enfant a collecté reste ; les nouvelles leçons et les nouveaux stickers sont verrouillés.`,
    stale: 'Connectez-vous à Internet pour confirmer Premium.',
    what: 'Premium ouvre :', list: ['Toutes les leçons et tous les niveaux', 'Tous les albums et stickers', 'Jusqu’à 4 enfants', 'Tout ce que nous ajouterons'],
    month: ['1 mois', 'par mois', ''], year: ['1 an', 'par an', 'Moitié prix du mensuel'], life: ['Pour toujours', 'un seul paiement', 'Avec tout ce que nous ajouterons'],
    buyWeb: 'Premium s’achète dans l’application Stick & Play pour Android ou iPhone. Connectez-vous-y avec le même compte et il s’ouvre ici aussi.',
    buySoon: 'Les achats ouvriront à la sortie de l’application sur le store.',
    promo: 'Code promo', ph: 'Code', apply: 'Valider', needAcc: 'Un code promo est gardé dans le compte parent. Connectez-vous d’abord.', toSettings: 'Se connecter',
    ok: d => `Le code est accepté. Premium est ouvert jusqu’au ${d}.`, okForever: 'Le code est accepté. Premium est ouvert pour toujours.',
    not_found: 'Ce code n’existe pas. Vérifiez les lettres.', expired_code: 'Ce code n’est plus valable.', exhausted: 'Ce code est épuisé.',
    already_used: 'Ce compte a déjà utilisé un code promo.', network: 'Pas de connexion. Réessayez plus tard.', signin: 'Connectez-vous d’abord.',
    line: 'J’ai un code promo', intro: 'Saisissez le code, puis connectez-vous par e-mail : les mois gratuits restent dans votre compte.',
    next: 'Suivant', back: 'Retour', cont: 'Continuer', without: 'Continuer sans code' },
  es: { tab: 'Desbloquear todo',
    free: (d, n) => `Plan gratis: ${n} lecciones y el primer álbum. Lecciones hechas: ${d} de ${n}.`,
    premium: d => `Premium está abierto hasta el ${d}.`, forever: 'Premium está abierto para siempre.', byCode: 'Abierto con un código promocional.',
    expired: d => `Premium terminó el ${d}. Todo lo que el niño reunió se queda; las lecciones y los stickers nuevos están bloqueados.`,
    stale: 'Conéctate a internet para confirmar Premium.',
    what: 'Premium abre:', list: ['Todas las lecciones y niveles', 'Todos los álbumes y stickers', 'Hasta 4 niños', 'Todo lo que añadamos después'],
    month: ['1 mes', 'al mes', ''], year: ['1 año', 'al año', 'La mitad que el mensual'], life: ['Para siempre', 'un solo pago', 'Con todo lo que añadamos después'],
    buyWeb: 'Premium se compra en la aplicación Stick & Play para Android o iPhone. Inicia sesión allí con la misma cuenta y también se abre aquí.',
    buySoon: 'Las compras se abrirán cuando la aplicación salga en la tienda.',
    promo: 'Código promocional', ph: 'Código', apply: 'Aplicar', needAcc: 'El código se guarda en la cuenta de los padres. Inicia sesión primero.', toSettings: 'Iniciar sesión',
    ok: d => `Código aceptado. Premium está abierto hasta el ${d}.`, okForever: 'Código aceptado. Premium está abierto para siempre.',
    not_found: 'Ese código no existe. Revisa las letras.', expired_code: 'Este código ya no es válido.', exhausted: 'Este código ya se ha agotado.',
    already_used: 'Esta cuenta ya usó un código promocional.', network: 'Sin conexión. Inténtalo más tarde.', signin: 'Inicia sesión primero.',
    line: 'Tengo un código promocional', intro: 'Escribe el código y luego inicia sesión con tu e-mail: los meses gratis se guardan en tu cuenta.',
    next: 'Siguiente', back: 'Atrás', cont: 'Continuar', without: 'Continuar sin código' },
};
export const premiumText = lang => T[lang] || T.en;
const day = (ms, lang) => new Date(ms).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
const errText = (t, e) => t[e === 'expired' ? 'expired_code' : e] || t.network;
const okText = (t, r, lang) => r.forever ? t.okForever : t.ok(day(Date.parse(r.until), lang));

/* ================= the "Unlock all" tab of the parent zone ================= */
// `toSettings()` opens the tab with the Account block: a promo code needs the parent's account.
export function mountPremium(el, { lang, toSettings }) {
  const t = premiumText(lang);
  let note = null, busy = false, typed = '';
  function draw() {
    const st = Premium.state(), acc = Cloud.account();
    const status = st.kind === 'premium' ? (st.forever ? t.forever : t.premium(day(st.until, lang))) + (st.source === 'promo' ? ' ' + t.byCode : '')
      : st.kind === 'expired' ? t.expired(day(st.until, lang)) : st.kind === 'stale' ? t.stale
      : t.free(Math.min(Premium.lessonsDone(), FREE.lessons), FREE.lessons);
    const names = { month: t.month, year: t.year, forever: t.life };
    const plans = PLANS.map(p => { const [name, per, why] = names[p.kind];
      return `<div class="plan ${p.best ? 'best' : ''}"><b>${name}</b><span class="pprice">${p.price}</span><small>${per}</small>${why ? `<i>${why}</i>` : ''}</div>`; }).join('');
    const promo = !promoAllowed ? '' : `<div class="pkids ppromo"><div class="ph">${t.promo}</div>${
      acc && !acc.pending ? `<div class="pkrow"><input type="text" id="pmCode" maxlength="24" autocomplete="off" autocapitalize="characters" placeholder="${t.ph}" value="${esc(typed)}" ${busy ? 'disabled' : ''}>
          <button class="on" id="pmApply" ${busy ? 'disabled' : ''}>${t.apply}</button></div>`
        : `<div class="pnote">${t.needAcc}</div><div class="pkrow"><button id="pmSign">${t.toSettings}</button></div>`}
      ${note ? `<div class="pnote ${note.bad ? 'pbad' : 'pgood'}">${esc(note.text)}</div>` : ''}</div>`;
    el.innerHTML = `<div class="pkids pprem ${st.kind}"><div class="ph">Premium</div>
        <div class="pstate">${esc(status)}</div>
        ${st.kind === 'premium' && st.forever ? '' : `<div class="pnote">${t.what}</div><ul class="pwhat">${t.list.map(x => `<li>${x}</li>`).join('')}</ul>
        <div class="plans">${plans}</div>
        <div class="pnote">${isNative ? t.buySoon : t.buyWeb}</div>`}
      </div>${promo}`;
    const on = (id, fn) => { const b = el.querySelector('#' + id); if (b) b.onclick = fn; };
    on('pmSign', toSettings);
    const apply = async () => {
      typed = el.querySelector('#pmCode').value.trim(); if (!typed || busy) return;
      busy = true; note = null; draw();
      const r = await Premium.redeem(typed);
      busy = false;
      note = r.ok ? { text: okText(t, r, lang) } : { text: errText(t, r.error), bad: true };
      if (r.ok) typed = '';
      if (el.isConnected) draw();
    };
    on('pmApply', apply);
    const input = el.querySelector('#pmCode'); if (input) input.onkeydown = ev => { if (ev.key === 'Enter') apply(); };
  }
  draw();
  Premium.refresh().then(() => { if (el.isConnected && !busy) draw(); });
}

/* ================= the promo code of the first run ================= */
// "I have a promo code" on the first-run screen (Android and the site; never in the iOS app): the code, then the
// sign-in, then the code is applied to the account. `onDone(joined)` gets what the sign-in found (the children that
// came from the cloud), or null if the parent was signed in already; `onBack()` returns to the form.
export function mountPromoStart(el, { lang, onBack, onDone }) {
  const t = premiumText(lang);
  let step = 'code', code = '', err = '', done = '', busy = false, joined = null;
  async function apply() {
    busy = true; err = ''; draw();
    const r = await Premium.redeem(code);
    busy = false;
    if (r.ok) { done = okText(t, r, lang); step = 'done'; } else { err = errText(t, r.error); step = 'code'; }
    if (el.isConnected) draw();
  }
  function draw() {
    const off = busy ? 'disabled' : '', acc = Cloud.account();
    if (step === 'signin') {
      mountSignIn(el, { lang, firstRun: true, onBack: () => { step = 'code'; draw(); }, onDone: r => { joined = r; apply(); } });
      return;
    }
    el.innerHTML = `<div class="signin promo ${busy ? 'busy' : ''}">${
      step === 'done' ? `<div class="sinote good">${esc(done)}</div><div class="sirow"><button class="on" id="prCont">${t.cont}</button></div>`
      : `${acc ? '' : `<div class="sinote">${t.intro}</div>`}
        <div class="sirow"><input type="text" id="prCode" maxlength="24" autocomplete="off" autocapitalize="characters" placeholder="${t.ph}" value="${esc(code)}" ${off}>
          <button class="on" id="prNext" ${off}>${acc ? t.apply : t.next}</button></div>
        ${err ? `<div class="sierr">${esc(err)}</div>` : ''}
        <button class="silink" id="prBack" ${off}>${joined ? t.without : t.back}</button>`}</div>`;
    const on = (id, fn) => { const b = el.querySelector('#' + id); if (b) b.onclick = fn; };
    const next = () => {
      code = el.querySelector('#prCode').value.trim(); if (!code) return;
      if (Cloud.account()) apply(); else { step = 'signin'; draw(); }
    };
    on('prNext', next);
    on('prCont', () => onDone(joined));
    // after a sign-in there is no way back to "not signed in": the line continues without a code
    on('prBack', () => (joined ? onDone(joined) : onBack()));
    const input = el.querySelector('#prCode');
    if (input) { input.onkeydown = ev => { if (ev.key === 'Enter') next(); }; if (!busy) input.focus(); }
  }
  draw();
}
