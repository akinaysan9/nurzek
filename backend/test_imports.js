import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cheerio from 'cheerio';
import fetch from 'node-fetch';
import initSqlJs from 'sql.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 } from 'uuid';
import cron from 'node-cron';
import { marked } from 'marked';

console.log('All modules loaded successfully');
