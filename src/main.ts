import './assets/tokens.css'
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { i18n } from './i18n'

const app = createApp(App)

// pinia before the router, the route guard reads the answers store
app.use(createPinia())
app.use(i18n)
app.use(router)

app.mount('#app')
