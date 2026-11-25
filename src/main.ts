import './assets/tokens.css'
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { i18n } from './i18n'
import { useDisplayStore } from './stores/display'
import { useSavedStore } from './stores/saved'

const app = createApp(App)

// pinia before the router, the route guard reads the answers store
app.use(createPinia())
app.use(i18n)

// picks up the phone's increase contrast setting before the first paint
useDisplayStore()
// anything saved on this device goes back in before the guard runs, so a
// refresh on the results stays on the results
const restoring = useSavedStore().load()

app.use(router)

restoring.finally(() => app.mount('#app'))
