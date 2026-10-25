<script setup lang="ts">
// Private artist share: own password, own cookie, only this share's files.
type Img = { n: string; w: number; h: number; private: boolean; name: string; bytes?: number; thumb: string; web: string; full: string }
type Share = {
  artist: string; title: string; session: string; expires?: string; authed: boolean
  hero?: Img[]; proofs?: { n: string; thumb: string }[]; zips?: { label: string; name: string; bytes: number; url: string }[]
}

const route = useRoute()
const slug = computed(() => String(route.params.slug || ''))
useHead({
  title: 'Private gallery · Photon·EsTuDios',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;1,6..96,400&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@300;400;500&family=Playfair+Display:wght@400;600&display=swap' },
  ],
})

const { data, refresh, error: loadError } = await useFetch<Share>(() => `/api/share/${slug.value}`, { key: `share-${slug.value}` })

// ---- login
const password = ref('')
const loginError = ref('')
const busy = ref(false)
async function login() {
  loginError.value = ''; busy.value = true
  try { await postSigned(`/api/share/${slug.value}/login`, { password: password.value }); await refresh() }
  catch { loginError.value = 'That password did not work. Check for spaces and try again.'; password.value = '' }
  finally { busy.value = false }
}

// ---- helpers
const mb = (b?: number) => (b ? `${(b / 1e6).toFixed(b > 1e8 ? 0 : 1)} MB` : '')
const expiresLabel = computed(() => data.value?.expires
  ? new Date(`${data.value.expires}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

// ---- lightbox
const lb = ref<number | null>(null)
const cur = computed(() => (lb.value === null ? null : data.value?.hero?.[lb.value] ?? null))
const step = (d: number) => { const n = data.value?.hero?.length || 0; if (lb.value !== null && n) lb.value = (lb.value + d + n) % n }
function onKey(e: KeyboardEvent) {
  if (lb.value === null) return
  if (e.key === 'Escape') lb.value = null
  else if (e.key === 'ArrowRight') step(1)
  else if (e.key === 'ArrowLeft') step(-1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
watch(lb, (v) => { if (import.meta.client) document.body.style.overflow = v === null ? '' : 'hidden' })

// ---- proof favourites (max 5)
const favs = ref<string[]>([])
const toggleFav = (n: string) => {
  const i = favs.value.indexOf(n)
  if (i >= 0) favs.value.splice(i, 1)
  else if (favs.value.length < 5) favs.value.push(n)
}

// ---- picks: proofs to finish + note (the usage release is signed on the teaser, before access)
const note = ref('')
const sent = ref<string | null>(null)
const formError = ref('')
const sending = ref(false)
onMounted(() => { try { sent.value = localStorage.getItem(`share-picks-${slug.value}`) } catch {} })
async function submitPicks() {
  formError.value = ''
  if (!favs.value.length && !note.value.trim()) { formError.value = 'Choose at least one frame or write a note.'; return }
  sending.value = true
  try {
    const r = await postSigned<{ receivedAt: string }>(`/api/share/${slug.value}/picks`, { favourites: favs.value, note: note.value })
    sent.value = r.receivedAt
    try { localStorage.setItem(`share-picks-${slug.value}`, r.receivedAt) } catch {}
  } catch { formError.value = 'Sending did not work. Please try again in a moment.' }
  finally { sending.value = false }
}
</script>

<template>
  <div class="sh">
    <header class="wrap top">
      <div class="wordmark" aria-label="Photon EsTuDios">Photon<span class="dot">·</span><b><em>Es</em>Tu<em>Di</em>os</b></div>
      <span class="mono">Private gallery</span>
    </header>

    <!-- not found -->
    <main v-if="loadError || !data" class="wrap gate">
      <h1 class="h1"><span class="pre">This link</span>has expired</h1>
      <p class="lede">The gallery is no longer available. Write to Daniela and she will send you a new link.</p>
    </main>

    <!-- password -->
    <main v-else-if="!data.authed" class="wrap gate">
      <p class="mono">{{ data.title }} · {{ data.session }}</p>
      <h1 class="h1"><span class="pre">This is</span>Mama Lou</h1>
      <form class="pw" @submit.prevent="login">
        <label for="pw" class="mono">Your password</label>
        <div class="pw-row">
          <input id="pw" v-model="password" type="password" autocomplete="current-password" required autofocus>
          <button type="submit" :disabled="busy">{{ busy ? 'Opening…' : 'Open gallery' }}</button>
        </div>
        <p v-if="loginError" class="err" role="alert">{{ loginError }}</p>
        <p class="hint">The password came with your invitation from Daniela.</p>
      </form>
    </main>

    <!-- gallery -->
    <main v-else class="wrap">
      <section class="intro">
        <div>
          <p class="mono">{{ data.title }} · {{ data.session }}</p>
          <h1 class="h1"><span class="pre">This is</span>Mama Lou</h1>
        </div>
        <div class="intro-text">
          <p class="lede">These photographs are yours, as a gift. Download the finished edit and the press kit below, and look through the proofs of the whole night.</p>
          <p class="small">At the end of this page I ask whether I may show the session in my own work. Your downloads do not depend on your answer.</p>
          <p v-if="expiresLabel" class="mono">Available until {{ expiresLabel }}</p>
        </div>
      </section>

      <section class="block" aria-labelledby="dl">
        <h2 id="dl" class="h2"><span class="num">01</span>Downloads</h2>
        <ul class="zips">
          <li v-for="z in data.zips" :key="z.name">
            <div><p class="zl">{{ z.label }}</p><p class="mono">{{ z.name }} · {{ mb(z.bytes) }}</p></div>
            <a class="btn" :href="z.url" rel="noopener">Download</a>
          </li>
        </ul>
        <p class="small">Large files. Wi-Fi is best. Each package includes the credit and usage notes.</p>
      </section>

      <section class="block" aria-labelledby="edit">
        <h2 id="edit" class="h2"><span class="num">02</span>The edit <small class="mono">{{ data.hero.length }} frames</small></h2>
        <div class="masonry">
          <figure v-for="(h, i) in data.hero" :key="h.name" class="tile">
            <button type="button" class="open" :aria-label="`View frame ${h.n} full screen`" @click="lb = i">
              <img :src="h.thumb" :width="h.w" :height="h.h" :alt="`This is Mama Lou, frame ${h.n}`" loading="lazy" decoding="async">
            </button>
            <figcaption class="mono"><span>№ {{ h.n }}</span><span v-if="h.private" class="priv">Private</span><a :href="h.full">Full size ↓</a></figcaption>
          </figure>
        </div>
      </section>

      <section class="block" aria-labelledby="proofs">
        <h2 id="proofs" class="h2"><span class="num">03</span>Proofs <small class="mono">143 frames</small></h2>
        <p class="small">Tap up to five frames you would like finished as well. Send them with the button below. <b>{{ favs.length }} of 5 chosen</b><span v-if="favs.length">: {{ favs.join(', ') }}</span></p>
        <div class="proofs">
          <button v-for="p in data.proofs" :key="p.n" type="button" class="proof" :class="{ on: favs.includes(p.n) }"
                  :aria-pressed="favs.includes(p.n)" :aria-label="`Proof ${p.n}`" @click="toggleFav(p.n)">
            <img :src="p.thumb" alt="" loading="lazy" decoding="async"><span class="pn">{{ p.n }}</span>
          </button>
        </div>
      </section>

      <section class="block rights" aria-labelledby="rights">
        <h2 id="rights" class="h2"><span class="num">04</span>Your picks</h2>
        <div v-if="sent" class="thanks" role="status">
          <p class="lede">Thank you. Your picks reached Daniela on {{ new Date(sent).toLocaleString('en-GB') }}.</p>
          <p class="small">Want to change them? Just write to her.</p>
        </div>
        <form v-else class="form" @submit.prevent="submitPicks">
          <p class="lede">Send Daniela the proofs you would like finished in full. <b>{{ favs.length }} of 5 chosen</b><span v-if="favs.length">: {{ favs.join(', ') }}</span></p>
          <label class="fields"><span class="mono">A note (optional)</span><textarea v-model="note" rows="3"></textarea></label>
          <p v-if="formError" class="err" role="alert">{{ formError }}</p>
          <button type="submit" class="btn big" :disabled="sending">{{ sending ? 'Sending…' : 'Send my picks' }}</button>
        </form>
      </section>
    </main>

    <footer class="wrap foot">
      <div class="wordmark" aria-label="Photon EsTuDios">Photon<span class="dot">·</span><b><em>Es</em>Tu<em>Di</em>os</b></div>
      <span class="mono">Artist consulting · Photo direction · Granada · photonestudios.com</span>
    </footer>

    <div v-if="cur" class="lb" role="dialog" aria-modal="true" aria-label="Full screen viewer" @click.self="lb = null">
      <div class="lb-bar mono"><span>№ {{ cur.n }} / {{ data?.hero?.length }}</span><button type="button" @click="lb = null">Close</button></div>
      <div class="lb-stage" @click.self="lb = null"><img :src="cur.web" :alt="`This is Mama Lou, frame ${cur.n}`"></div>
      <div class="lb-nav"><button type="button" @click="step(-1)">← Prev</button><a class="lbdl" :href="cur.full">Download full size</a><button type="button" @click="step(1)">Next →</button></div>
    </div>
  </div>
</template>

<style scoped>
.sh { --paper: #f1eadf; --ink: #1f170e; --mu: #6c5d48; --ac: #8a6424; --line: #d9cbb4; --gold: #c4933f;
  --display: 'Bodoni Moda', 'Didot', Georgia, serif; --mono: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
  --body: 'Inter', 'Helvetica Neue', Arial, sans-serif; --brand: 'Playfair Display', Georgia, serif;
  min-height: 100vh; background: var(--paper); color: var(--ink); font: 300 16px/1.6 var(--body); color-scheme: light; }
.wrap { max-width: 1320px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
@media (min-width: 900px) { .wrap { padding-left: max(48px, env(safe-area-inset-left, 0px)); padding-right: max(48px, env(safe-area-inset-right, 0px)); } }
.top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding-block: 26px 0; }
.wordmark { font-family: var(--brand); font-size: 1.05rem; letter-spacing: .03em; }
.wordmark .dot { color: var(--gold); margin: 0 .08em; } .wordmark b { font-weight: 600; } .wordmark em { font-style: normal; color: var(--gold); }
.mono { font-family: var(--mono); font-size: .72rem; letter-spacing: .12em; text-transform: uppercase; color: var(--mu); }
.h1 { margin: 10px 0 0; font-family: var(--display); font-weight: 400; font-size: clamp(3.4rem, 11vw, 9rem); line-height: .86; letter-spacing: -.03em; }
.h1 .pre { display: block; font-style: italic; font-size: .32em; letter-spacing: 0; color: var(--ac); margin-bottom: .25em; }
.lede { font-size: 1.08rem; max-width: 52ch; margin: 0; }
.small { font-size: .9rem; color: var(--mu); max-width: 62ch; margin: 0; }
.err { color: #9b2c1c; font-size: .9rem; margin: 0; }
.gate { padding-block: 12vh 16vh; display: grid; gap: 28px; }
.pw { display: grid; gap: 10px; max-width: 460px; }
.pw-row { display: flex; gap: 8px; flex-wrap: wrap; }
input, textarea { font: 400 1rem var(--body); color: var(--ink); background: #fbf7f0; border: 1px solid var(--line); padding: 12px 14px; border-radius: 0; min-width: 0; }
input:focus, textarea:focus, button:focus-visible, a:focus-visible { outline: 2px solid var(--ac); outline-offset: 2px; }
.pw-row input { flex: 1 1 220px; }
button, .btn { font: 500 .74rem/1 var(--mono); letter-spacing: .16em; text-transform: uppercase; background: var(--ink); color: var(--paper); border: 1px solid var(--ink); padding: 13px 20px; cursor: pointer; text-decoration: none; display: inline-block; }
button:hover, .btn:hover { background: var(--ac); border-color: var(--ac); }
button:disabled { opacity: .5; cursor: default; }
.hint { font-size: .85rem; color: var(--mu); margin: 0; }
.intro { display: grid; gap: 24px; padding-block: 40px 56px; align-items: end; border-bottom: 1px solid var(--line); }
@media (min-width: 900px) { .intro { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); padding-block: 64px 80px; } }
.intro-text { display: grid; gap: 14px; }
.block { padding-block: 56px; border-bottom: 1px solid var(--line); display: grid; gap: 22px; }
.h2 { margin: 0; font-family: var(--display); font-weight: 400; font-style: italic; font-size: clamp(1.9rem, 4vw, 3rem); line-height: 1; display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
.h2 .num { font-family: var(--mono); font-style: normal; font-size: .8rem; letter-spacing: .2em; color: var(--ac); }
.h2 small { font-style: normal; }
.zips { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; border-top: 1px solid var(--line); }
.zips li { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 18px 0; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.zips li > div { min-width: 0; }
.zl { margin: 0 0 4px; font-size: 1.05rem; }
.masonry { columns: 2 160px; column-gap: 14px; }
@media (min-width: 900px) { .masonry { columns: 4 220px; column-gap: 22px; } }
.tile { break-inside: avoid; margin: 0 0 22px; display: grid; gap: 8px; }
.open { all: unset; cursor: zoom-in; display: block; }
.open img, .proof img { display: block; width: 100%; height: auto; background: #e6dccb; }
.tile figcaption { display: flex; justify-content: space-between; gap: 8px; font-size: .64rem; }
.tile figcaption a { color: var(--ac); text-decoration: none; }
.priv { color: #9b2c1c; }
.proofs { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; }
.proof { all: unset; position: relative; cursor: pointer; display: block; outline: 3px solid transparent; outline-offset: -3px; }
.proof.on { outline-color: var(--gold); }
.proof.on::after { content: '★'; position: absolute; top: 4px; right: 6px; color: var(--gold); font-size: 18px; text-shadow: 0 1px 3px rgba(0,0,0,.6); }
.proof:focus-visible { outline-color: var(--ac); }
.pn { position: absolute; left: 4px; bottom: 3px; font: 500 .6rem var(--mono); color: #fff; background: rgba(0,0,0,.45); padding: 0 4px; }
.rights { border-bottom: 0; }
.form { display: grid; gap: 22px; max-width: 760px; }
fieldset { border: 1px solid var(--line); padding: 18px; margin: 0; display: grid; gap: 12px; min-width: 0; }
legend { padding: 0 6px; }
.check { display: flex; gap: 12px; align-items: flex-start; font-size: .96rem; }
.check input { width: 18px; height: 18px; margin-top: 3px; flex: none; accent-color: var(--ac); padding: 0; }
.link { all: unset; cursor: pointer; font: 500 .7rem var(--mono); letter-spacing: .12em; text-transform: uppercase; color: var(--ac); border-bottom: 1px solid var(--ac); justify-self: start; }
.fields { display: grid; gap: 14px; }
@media (min-width: 700px) { .fields { grid-template-columns: 1fr 1fr; } .fields .wide { grid-column: 1 / -1; } }
.fields label { display: grid; gap: 6px; min-width: 0; }
.sig { font-family: var(--display); font-style: italic; font-size: 1.3rem; }
.btn.big { justify-self: start; padding: 16px 26px; }
.thanks { display: grid; gap: 10px; }
.foot { padding-block: 32px 44px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: baseline; border-top: 1px solid var(--line); }
.foot .wordmark { font-size: 1.5rem; }
.lb { position: fixed; inset: 0; z-index: 50; background: #0d0c0f; color: #efe6d6; display: grid; grid-template-rows: auto 1fr auto; padding: calc(env(safe-area-inset-top, 0px) + 12px) max(16px, env(safe-area-inset-right, 0px)) calc(env(safe-area-inset-bottom, 0px) + 12px) max(16px, env(safe-area-inset-left, 0px)); }
.lb-bar { display: flex; justify-content: space-between; align-items: center; color: #a49a8a; }
.lb-stage { display: grid; place-items: center; min-height: 0; }
.lb-stage img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
.lb-nav { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
.lb button, .lbdl { font: 500 .7rem/1 var(--mono); letter-spacing: .16em; text-transform: uppercase; color: #efe6d6; background: transparent; border: 1px solid #4a4438; padding: 12px 16px; text-decoration: none; cursor: pointer; }
.lb button:hover, .lbdl:hover { border-color: #d4a350; color: #d4a350; background: transparent; }
</style>
