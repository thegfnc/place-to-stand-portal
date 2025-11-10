#!/usr/bin/env tsx
/**
 * Script to analyze current RLS policies in Supabase
 *
 * This script connects to Supabase and identifies all tables with multiple
 * permissive policies for the same operation, which need to be consolidated.
 *
 * Usage:
 *   npx tsx scripts/analyze-rls-policies.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL');
  console.error('  SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface PolicyInfo {
  schemaname: string;
  tablename: string;
  policyname: string;
  permissive: 'PERMISSIVE' | 'RESTRICTIVE';
  roles: string[];
  cmd: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  qual: string | null;
  with_check: string | null;
}

interface PolicyGroup {
  table: string;
  operation: string;
  policies: PolicyInfo[];
  needsConsolidation: boolean;
}

async function analyzeRLSPolicies() {
  console.log('Analyzing RLS policies...\n');

  // Query to get all RLS policies
  const { data: policies, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND permissive = 'PERMISSIVE'
      ORDER BY tablename, cmd, policyname;
    `,
  });

  let policiesData = policies;

  if (error) {
    // If exec_sql doesn't exist, use direct query
    const { data: directData, error: directError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('schemaname', 'public')
      .eq('permissive', 'PERMISSIVE');

    if (directError) {
      console.error('Error fetching policies:', directError);
      console.error('\nNote: This script requires direct database access.');
      console.error('You may need to run this query directly in Supabase SQL Editor:');
      console.error(`
        SELECT
          schemaname,
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual,
          with_check
        FROM pg_policies
        WHERE schemaname = 'public'
          AND permissive = 'PERMISSIVE'
        ORDER BY tablename, cmd, policyname;
      `);
      process.exit(1);
    }

    policiesData = directData as PolicyInfo[] | null;
  }

  // Group policies by table and operation
  const policyGroups = new Map<string, PolicyGroup>();

  if (policiesData && Array.isArray(policiesData)) {
    for (const policy of policiesData as PolicyInfo[]) {
      const key = `${policy.tablename}:${policy.cmd}`;

      if (!policyGroups.has(key)) {
        policyGroups.set(key, {
          table: policy.tablename,
          operation: policy.cmd,
          policies: [],
          needsConsolidation: false,
        });
      }

      const group = policyGroups.get(key)!;
      group.policies.push(policy);
    }
  }

  // Identify groups that need consolidation (multiple policies for same operation)
  const needsConsolidation: PolicyGroup[] = [];
  let totalDuplicatePolicies = 0;

  for (const group of policyGroups.values()) {
    if (group.policies.length > 1) {
      group.needsConsolidation = true;
      needsConsolidation.push(group);
      totalDuplicatePolicies += group.policies.length - 1; // -1 because we keep one
    }
  }

  // Print summary
  console.log('='.repeat(80));
  console.log('RLS Policy Analysis Summary');
  console.log('='.repeat(80));
  console.log(`Total tables with RLS: ${policyGroups.size}`);
  console.log(`Tables needing consolidation: ${needsConsolidation.length}`);
  console.log(`Total duplicate policies to consolidate: ${totalDuplicatePolicies}`);
  console.log();

  // Print detailed breakdown
  console.log('='.repeat(80));
  console.log('Tables Needing Policy Consolidation');
  console.log('='.repeat(80));

  for (const group of needsConsolidation.sort((a, b) => a.table.localeCompare(b.table))) {
    console.log(`\n📋 ${group.table} (${group.operation})`);
    console.log(`   ${group.policies.length} policies found:`);

    for (const policy of group.policies) {
      console.log(`   - ${policy.policyname}`);
      if (policy.roles && policy.roles.length > 0) {
        console.log(`     Roles: ${policy.roles.join(', ')}`);
      }
      if (policy.qual) {
        const qualPreview = policy.qual.length > 60
          ? policy.qual.substring(0, 60) + '...'
          : policy.qual;
        console.log(`     Using: ${qualPreview}`);
      }
      if (policy.with_check) {
        const checkPreview = policy.with_check.length > 60
          ? policy.with_check.substring(0, 60) + '...'
          : policy.with_check;
        console.log(`     With Check: ${checkPreview}`);
      }
    }
  }

  // Generate consolidation recommendations
  console.log('\n' + '='.repeat(80));
  console.log('Consolidation Recommendations');
  console.log('='.repeat(80));

  // Group by priority (simpler tables first)
  const priorityOrder = [
    'activity_overview_cache',
    'users',
    'client_members',
    'activity_logs',
    'task_assignees',
    'project_members',
    'clients',
    'projects',
    'hour_blocks',
    'tasks',
    'task_comments',
    'task_attachments',
    'time_logs',
    'time_log_tasks',
  ];

  const prioritized = needsConsolidation.sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a.table);
    const bIndex = priorityOrder.indexOf(b.table);
    if (aIndex === -1 && bIndex === -1) return a.table.localeCompare(b.table);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  console.log('\nRecommended consolidation order:\n');
  prioritized.forEach((group, index) => {
    const complexity =
      group.policies.length <= 2 ? '🟢 Low' :
      group.policies.length <= 4 ? '🟡 Medium' :
      '🔴 High';

    console.log(`${index + 1}. ${group.table} (${group.operation}) - ${complexity} complexity`);
    console.log(`   Consolidate ${group.policies.length} policies into 1`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('Next Steps');
  console.log('='.repeat(80));
  console.log('1. Review the tables listed above');
  console.log('2. Start with Phase 1 (low complexity tables)');
  console.log('3. Create migration files for each consolidation');
  console.log('4. Test thoroughly in dev/staging before production');
  console.log('5. Monitor performance after each consolidation');
}

// Run the analysis
analyzeRLSPolicies().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

