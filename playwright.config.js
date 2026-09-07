import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',testMatch:'browser.spec.js',timeout:90000,use:{viewport:{width:1440,height:1000},channel:'msedge',headless:true},reporter:'list'});
