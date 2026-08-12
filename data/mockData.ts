import type {
  Action,
  Department,
  Member,
} from '@/types';

export const members: Member[] = [
  {
    id: 'm1',
    name: 'Rahul Sharma',
    email: 'rahul@example.com',
    role: 'Marketing Manager',
    departmentId: 'dept-marketing',
  },
  {
    id: 'm2',
    name: 'Priya Shah',
    email: 'priya@example.com',
    role: 'Marketing Executive',
    departmentId: 'dept-marketing',
  },
  {
    id: 'm3',
    name: 'Amit Kumar',
    email: 'amit@example.com',
    role: 'Sales Manager',
    departmentId: 'dept-sales',
  },
  {
    id: 'm4',
    name: 'Sofia Rodriguez',
    email: 'sofia@example.com',
    role: 'Operations Manager',
    departmentId: 'dept-operations',
  },
  {
    id: 'm5',
    name: 'Liam Chen',
    email: 'liam@example.com',
    role: 'Accountant',
    departmentId: 'dept-accounting',
  },
  {
    id: 'm6',
    name: 'Nina Patel',
    email: 'nina@example.com',
    role: 'R&D Engineer',
    departmentId: 'dept-rd',
  },
  {
    id: 'm7',
    name: 'James Wilson',
    email: 'james@example.com',
    role: 'Creative Artist',
    departmentId: 'dept-artist',
  },
  {
    id: 'm8',
    name: 'Maria Garcia',
    email: 'maria@example.com',
    role: 'Administrator',
    departmentId: 'dept-admin',
  },
];

function createAction(
  id: string,
  goalId: string,
  title: string,
  memberIds: string[],
  progress: number,
  status: Action['status'],
  priority: Action['priority']
): Action {
  return {
    id,
    goalId,
    title,
    assignedMemberIds: memberIds,
    progress,
    status,
    priority,
  };
}

export const departments: Department[] = [
  {
    id: 'dept-marketing',
    name: 'Marketing',
    description: 'Brand awareness, leads and client acquisition.',
    headId: 'm1',
    memberIds: ['m1', 'm2'],
    progress: 55,
    isActive: true,

    goals: [
      {
        id: 'marketing-goal-1',
        departmentId: 'dept-marketing',
        title: 'Increase Brand Awareness',
        description: 'Improve company visibility across digital channels.',
        progress: 55,

        actions: [
          createAction(
            'marketing-action-1',
            'marketing-goal-1',
            'Launch social media campaign',
            ['m1', 'm2'],
            70,
            'In Progress',
            'High'
          ),

          createAction(
            'marketing-action-2',
            'marketing-goal-1',
            'Prepare monthly content calendar',
            ['m2'],
            40,
            'In Progress',
            'Medium'
          ),
        ],
      },
    ],
  },

  {
    id: 'dept-sales',
    name: 'Sales',
    description: 'Revenue generation and customer acquisition.',
    headId: 'm3',
    memberIds: ['m3'],
    progress: 45,
    isActive: true,

    goals: [
      {
        id: 'sales-goal-1',
        departmentId: 'dept-sales',
        title: 'Increase Monthly Revenue',
        description: 'Improve qualified opportunities and deal conversions.',
        progress: 45,

        actions: [
          createAction(
            'sales-action-1',
            'sales-goal-1',
            'Build qualified prospect pipeline',
            ['m3'],
            60,
            'In Progress',
            'High'
          ),

          createAction(
            'sales-action-2',
            'sales-goal-1',
            'Improve sales follow-up process',
            ['m3'],
            30,
            'In Progress',
            'Medium'
          ),
        ],
      },
    ],
  },

  {
    id: 'dept-operations',
    name: 'Operations - Management',
    description: 'Internal operations and delivery management.',
    headId: 'm4',
    memberIds: ['m4'],
    progress: 65,
    isActive: true,

    goals: [
      {
        id: 'operations-goal-1',
        departmentId: 'dept-operations',
        title: 'Improve Operational Efficiency',
        description: 'Improve processes and project delivery.',
        progress: 65,

        actions: [
          createAction(
            'operations-action-1',
            'operations-goal-1',
            'Document internal workflows',
            ['m4'],
            80,
            'In Progress',
            'Medium'
          ),

          createAction(
            'operations-action-2',
            'operations-goal-1',
            'Create weekly project review',
            ['m4'],
            50,
            'In Progress',
            'High'
          ),
        ],
      },
    ],
  },

  {
    id: 'dept-artist',
    name: 'Operations - Artist',
    description: 'Creative delivery and production management.',
    headId: 'm7',
    memberIds: ['m7'],
    progress: 50,
    isActive: true,

    goals: [
      {
        id: 'artist-goal-1',
        departmentId: 'dept-artist',
        title: 'Improve Creative Delivery',
        description: 'Improve quality and delivery timelines.',
        progress: 50,

        actions: [
          createAction(
            'artist-action-1',
            'artist-goal-1',
            'Create creative delivery checklist',
            ['m7'],
            50,
            'In Progress',
            'Medium'
          ),

          createAction(
            'artist-action-2',
            'artist-goal-1',
            'Improve design review process',
            ['m7'],
            50,
            'In Progress',
            'Medium'
          ),
        ],
      },
    ],
  },

  {
    id: 'dept-accounting',
    name: 'Accounting',
    description: 'Finance, billing and financial reporting.',
    headId: 'm5',
    memberIds: ['m5'],
    progress: 75,
    isActive: true,

    goals: [
      {
        id: 'accounting-goal-1',
        departmentId: 'dept-accounting',
        title: 'Improve Financial Reporting',
        progress: 75,

        actions: [
          createAction(
            'accounting-action-1',
            'accounting-goal-1',
            'Complete monthly financial report',
            ['m5'],
            90,
            'In Progress',
            'High'
          ),

          createAction(
            'accounting-action-2',
            'accounting-goal-1',
            'Review expense records',
            ['m5'],
            60,
            'In Progress',
            'Medium'
          ),
        ],
      },
    ],
  },

  {
    id: 'dept-rd',
    name: 'R&D',
    description: 'Research, innovation and new technology.',
    headId: 'm6',
    memberIds: ['m6'],
    progress: 35,
    isActive: true,

    goals: [
      {
        id: 'rd-goal-1',
        departmentId: 'dept-rd',
        title: 'Technology Research',
        progress: 35,

        actions: [
          createAction(
            'rd-action-1',
            'rd-goal-1',
            'Research automation opportunities',
            ['m6'],
            40,
            'In Progress',
            'High'
          ),

          createAction(
            'rd-action-2',
            'rd-goal-1',
            'Prepare technology roadmap',
            ['m6'],
            30,
            'In Progress',
            'Medium'
          ),
        ],
      },
    ],
  },

  {
    id: 'dept-admin',
    name: 'Admin',
    description: 'Administration and internal governance.',
    headId: 'm8',
    memberIds: ['m8'],
    progress: 70,
    isActive: true,

    goals: [
      {
        id: 'admin-goal-1',
        departmentId: 'dept-admin',
        title: 'Improve Administration',
        progress: 70,

        actions: [
          createAction(
            'admin-action-1',
            'admin-goal-1',
            'Update company documentation',
            ['m8'],
            70,
            'In Progress',
            'Medium'
          ),

          createAction(
            'admin-action-2',
            'admin-goal-1',
            'Review internal policies',
            ['m8'],
            70,
            'In Progress',
            'High'
          ),
        ],
      },
    ],
  },
];

export const mockData = {
  departments,
  members,
};