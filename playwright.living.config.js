import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'living.browser.spec.js',timeout:90000,workers:1,use:{baseURL:process.env.ORBIT_TEST_URL||'http://127.0.0.1:5175',viewport:{width:1440,height:1000},channel:'msedge',headless:true},reporter:'list'});
