import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '../assets/styles/tokens.css'
import '../assets/styles/common.css'
import App from './AppOptions.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
