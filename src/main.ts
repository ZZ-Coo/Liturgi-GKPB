import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { initTheme } from './composables/theme'
import './style.css'

// Applied synchronously before mount, straight to <html> — waiting until
// a component's onMounted would mean a light-mode flash for anyone who
// has dark saved.
initTheme()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')