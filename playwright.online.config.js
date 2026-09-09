import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'online.browser.spec.js',timeout:180000,workers:1,use:{channel:'msedge',headless:true},reporter:'list'});
