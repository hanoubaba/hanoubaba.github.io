import { COST } from './constants.js';

export const SUPABASE = {
  url: 'https://rxggjijrfafcrmtkqkuv.supabase.co',
  key: 'sb_publishable_8B1PLTeHhtPou4lPt9cl6w_O2hipMVY',
  authStorageKey: 'ok_supabase_session',
  refreshLeadMs: 10 * 60 * 1000,
  accessTokenSkewMs: 2 * 60 * 1000,
  loginEmailSuffix: '@ok.local',
  settingsId: 'default',
  defaultUnitCost: COST.defaultUnit,
};

export const ENDPOINTS = {
  auth: `${SUPABASE.url}/auth/v1/token`,
  strategies: `${SUPABASE.url}/rest/v1/strategies`,
  strategyStats: `${SUPABASE.url}/rest/v1/rpc/get_strategy_stats`,
  recent10Stats: `${SUPABASE.url}/rest/v1/rpc/get_recent_10_stats`,
  observations: `${SUPABASE.url}/rest/v1/observation_records`,
  settings: `${SUPABASE.url}/rest/v1/app_settings`,
};
