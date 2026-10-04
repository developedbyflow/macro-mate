export const admin = {
  title: 'Admin',
  link: 'Admin',
  linkText: 'The shared food base, reports and roles.',
  offline: 'You need internet for admin tasks.',
  loading: 'Loading…',
  tabs: {
    demand: 'Demand',
    reports: 'Reports',
    users: 'Users',
  },
  demand: {
    intro: 'Foods people added to their kitchens, most wanted first. Add them to the shared base so everyone sees them.',
    kitchens_one: 'in {{count}} kitchen',
    kitchens_other: 'in {{count}} kitchens',
    inBase: 'already in the base',
    promote: 'Add to base',
    promoted: '{{name}} is now in the shared base.',
    empty: 'Nobody has added foods to their kitchen yet.',
  },
  reports: {
    intro: 'Mistakes people reported in shared foods. Fix the food, then tap “Resolved”.',
    from: 'from {{name}}, {{date}}',
    open: 'Open the food',
    resolve: 'Resolved',
    empty: 'No open reports.',
  },
  users: {
    intro: 'Admins edit the shared food base and give roles.',
    admin: 'Admin',
    unconfirmed: 'unconfirmed',
    you: '(you)',
  },
}
