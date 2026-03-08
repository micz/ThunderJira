import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import '../../assets/styles/tokens.css'
import '../../assets/styles/common.css'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
