import { Member, Action, Goal, Department } from '../types/index';

// Seed members
const members: Member[] = [
  {
    id: 'm1',
    name: 'Rahul Sharma',
    email: 'rahul.sharma@example.com',
    role: 'Senior Project Manager',
    departmentId: 'dept-marketing',
    specialization: 'Client Services',
  },
  {
    id: 'm2',
    name: 'Priya Shah',
    email: 'priya.shah@example.com',
    role: 'Marketing Specialist',
    departmentId: 'dept-marketing',
    specialization: 'Digital Marketing',
  },
  {
    id: 'm3',
    name: 'Amit Kumar',
    email: 'amit.kumar@example.com',
    role: 'Sales Director',
    departmentId: 'dept-sales',
    specialization: 'Enterprise Sales',
  },
  {
    id: 'm4',
    name: 'Sofia Rodriguez',
    email: 'sofia.rodriguez@example.com',
    role: 'Operations Manager',
    departmentId: 'dept-operations-management',
    specialization: 'Process Optimization',
  },
  {
    id: 'm5',
    name: 'Liam Chen',
    email: 'liam.chen@example.com',
    role: 'Financial Analyst',
    departmentId: 'dept-accounting',
    specialization: 'Budgeting',
  },
  {
    id: 'm6',
    name: 'Nina Patel',
    email: 'nina.patel@example.com',
    role: 'R&D Engineer',
    departmentId: 'dept-rd',
    specialization: 'Machine Learning',
  },
  {
    id: 'm7',
    name: 'James Wilson',
    email: 'james.wilson@example.com',
    role: 'Artist',
    departmentId: 'dept-artist',
    specialization: 'Visual Arts',
  },
  {
    id: 'm8',
    name: 'Maria Garcia',
    email: 'maria.garcia@example.com',
    role: 'Administrator',
    departmentId: 'dept-admin',
    specialization: 'System Administration',
  },
];

// Seed departments with goals and actions (each with 3 goals, each with 3 actions)
// Marketing Department
const marketingGoals: Goal[] = [
  {
    id: 'g1',
    departmentId: 'dept-marketing',
    title: 'Increase Brand Awareness',
    description: 'Build brand recognition through digital channels',
    progress: 35,
    actions: [
      {
        id: 'a1',
        goalId: 'g1',
        title: 'Launch Social Media Campaign',
        description: 'Create and execute a multi-channel social media strategy',
        assignedMemberIds: ['m1', 'm2'],
        status: 'In Progress',
        progress: 40,
        dueDate: '2026-09-15',
        priority: 'High',
      },
      {
        id: 'a2',
        goalId: 'g1',
        title: 'Publish Weekly Content Calendar',
        description: 'Plan and schedule weekly blog posts and newsletters',
        assignedMemberIds: ['m2'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-08-30',
        priority: 'Medium',
      },
      {
        id: 'a3',
        goalId: 'g1',
        title: 'Organize Brand Events',
        description: 'Host at least 2 brand awareness events',
        assignedMemberIds: ['m1'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-10-10',
        priority: 'Medium',
      }
    ]
  },
  {
    id: 'g2',
    departmentId: 'dept-marketing',
    title: 'Generate Qualified Leads',
    description: 'Increase lead generation through targeted campaigns',
    progress: 25,
    actions: [
      {
        id: 'a4',
        goalId: 'g2',
        title: 'Optimize SEO Strategy',
        description: 'Improve website SEO ranking for key terms',
        assignedMemberIds: ['m3'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-09-20',
        priority: 'High',
      },
      {
        id: 'a5',
        goalId: 'g2',
        title: 'Create Marketing Automation Workflow',
        description: 'Develop automated lead nurturing sequences',
        assignedMemberIds: ['m3'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-09-01',
        priority: 'Medium',
      },
      {
        id: 'a6',
        goalId: 'g2',
        title: 'Launch PPC Campaigns',
        description: 'Run targeted pay-per-click ad campaigns',
        assignedMemberIds: ['m3'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-09-15',
        priority: 'High',
      }
    ]
  },
  {
    id: 'g3',
    departmentId: 'dept-marketing',
    title: 'Improve Customer Retention',
    description: 'Enhance customer loyalty and engagement',
    progress: 40,
    actions: [
      {
        id: 'a7',
        goalId: 'g3',
        title: 'Implement Customer Loyalty Program',
        description: 'Design and launch a rewards program for repeat customers',
        assignedMemberIds: ['m2'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-10-15',
        priority: 'Medium',
      },
      {
        id: 'a8',
        goalId: 'g3',
        title: 'Create Personalized Email Campaigns',
        description: 'Segment and personalize email communications',
        assignedMemberIds: ['m2'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-09-30',
        priority: 'Medium',
      },
      {
        id: 'a9',
        goalId: 'g3',
        title: 'Launch Customer Feedback Survey',
        description: 'Collect and analyze customer satisfaction data',
        assignedMemberIds: ['m1'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-09-10',
        priority: 'Low',
      }
    ]
  }
];

// Sales Department
const salesGoals: Goal[] = [
  {
    id: 'g4',
    departmentId: 'dept-sales',
    title: 'Streamline Sales Process',
    description: 'Optimize sales workflow for greater efficiency',
    progress: 50,
    actions: [
      {
        id: 'a10',
        goalId: 'g4',
        title: 'Implement CRM Best Practices',
        description: 'Standardize CRM usage across sales team',
        assignedMemberIds: ['m3'],
        status: 'In Progress',
        progress: 55,
        dueDate: '2026-08-31',
        priority: 'High',
      },
      {
        id: 'a11',
        goalId: 'g4',
        title: 'Create Sales Playbook',
        description: 'Document standard sales processes and scripts',
        assignedMemberIds: ['m3'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-10-05',
        priority: 'Medium',
      },
      {
        id: 'a12',
        goalId: 'g4',
        title: 'Train Sales Team on New Techniques',
        description: 'Implement new sales training program',
        assignedMemberIds: ['m3'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-11-01',
        priority: 'Medium',
      }
    ]
  },
  {
    id: 'g5',
    departmentId: 'dept-sales',
    title: 'Increase Average Deal Size',
    description: 'Maximize revenue per transaction',
    progress: 30,
    actions: [
      {
        id: 'a13',
        goalId: 'g5',
        title: 'Introduce Premium Service Tier',
        description: 'Develop and launch premium offering',
        assignedMemberIds: ['m3'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-11-30',
        priority: 'High',
      },
      {
        id: 'a14',
        goalId: 'g5',
        title: 'Implement Upsell Training Program',
        description: 'Train sales team on upselling techniques',
        assignedMemberIds: ['m3'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-09-25',
        priority: 'Medium',
      },
      {
        id: 'a15',
        goalId: 'g5',
        title: 'Create Bundle Deals',
        description: 'Design product bundles for higher value sales',
        assignedMemberIds: ['m3'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-10-15',
        priority: 'Medium',
      }
    ]
  },
  {
    id: 'g6',
    departmentId: 'dept-sales',
    title: 'Expand Market Reach',
    description: 'Enter new geographic markets and segments',
    progress: 20,
    actions: [
      {
        id: 'a16',
        goalId: 'g6',
        title: 'Conduct Market Research',
        description: 'Analyze potential new markets for expansion',
        assignedMemberIds: ['m3'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-10-20',
        priority: 'Low',
      },
      {
        id: 'a17',
        goalId: 'g6',
        title: 'Identify Distribution Partners',
        description: 'Find strategic partners for market entry',
        assignedMemberIds: ['m3'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-11-15',
        priority: 'Medium',
      },
      {
        id: 'a18',
        goalId: 'g6',
        title: 'Develop Go-to-Market Strategy',
        description: 'Create plan for entering new markets',
        assignedMemberIds: ['m3'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-12-01',
        priority: 'High',
      }
    ]
  }
];

// Operations Management Department
const operationsManagementGoals: Goal[] = [
  {
    id: 'g7',
    departmentId: 'dept-operations-management',
    title: 'Optimize Project Delivery',
    description: 'Streamline project execution processes',
    progress: 60,
    actions: [
      {
        id: 'a19',
        goalId: 'g7',
        title: 'Implement Project Tracking System',
        description: 'Adopt centralized project management tool',
        assignedMemberIds: ['m4'],
        status: 'In Progress',
        progress: 65,
        dueDate: '2026-09-05',
        priority: 'High',
      },
      {
        id: 'a20',
        goalId: 'g7',
        title: 'Create Standard Operating Procedures',
        description: 'Document SOPs for core operations',
        assignedMemberIds: ['m4'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-10-01',
        priority: 'Medium',
      },
      {
        id: 'a21',
        goalId: 'g7',
        title: 'Facilitate Cross-Department Meetings',
        description: 'Organize regular sync-ups between departments',
        assignedMemberIds: ['m4'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-09-22',
        priority: 'Medium',
      }
    ]
  },
  {
    id: 'g8',
    departmentId: 'dept-operations-management',
    title: 'Reduce Operational Costs',
    description: 'Minimize waste and improve efficiency',
    progress: 35,
    actions: [
      {
        id: 'a22',
        goalId: 'g8',
        title: 'Conduct Cost Analysis Audit',
        description: 'Review current expenses and identify areas for reduction',
        assignedMemberIds: ['m4'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-09-18',
        priority: 'High',
      },
      {
        id: 'a23',
        goalId: 'g8',
        title: 'Implement Energy Efficiency Measures',
        description: 'Adopt environmentally friendly cost-saving practices',
        assignedMemberIds: ['m4'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-11-05',
        priority: 'Medium',
      },
      {
        id: 'a24',
        goalId: 'g8',
        title: 'Optimize Resource Allocation',
        description: 'Improve utilization of operational resources',
        assignedMemberIds: ['m4'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-12-01',
        priority: 'High',
      }
    ]
  },
  {
    id: 'g9',
    departmentId: 'dept-operations-management',
    title: 'Improve Team Collaboration',
    description: 'Enhance inter-department communication',
    progress: 45,
    actions: [
      {
        id: 'a25',
        goalId: 'g9',
        title: 'Implement Collaboration Tools',
        description: 'Adopt unified communication platforms',
        assignedMemberIds: ['m4'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-09-30',
        priority: 'Medium',
      },
      {
        id: 'a26',
        goalId: 'g9',
        title: 'Establish Knowledge Sharing Sessions',
        description: 'Create regular insights sharing meetings',
        assignedMemberIds: ['m4'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-10-10',
        priority: 'Low',
      },
      {
        id: 'a27',
        goalId: 'g9',
        title: 'Implement Feedback Loops',
        description: 'Create continuous improvement mechanisms',
        assignedMemberIds: ['m4'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-10-25',
        priority: 'Medium',
      }
    ]
  }
];

// Operations Artist Department
const operationsArtistGoals: Goal[] = [
  {
    id: 'g10',
    departmentId: 'dept-artist',
    title: 'LIVE PROJECTS',
    description: 'Client work delivery',
    progress: 70,
    actions: [
      {
        id: 'a1',
        goalId: 'g10',
        title: 'Client Project Pipeline Review',
        description: 'Manage current client workload',
        assignedMemberIds: ['m7'],
        status: 'In Progress',
        progress: 75,
        dueDate: '2026-09-15',
        priority: 'High',
      },
      {
        id: 'a2',
        goalId: 'g10',
        title: 'Project Status Reporting',
        description: 'Weekly progress updates',
        assignedMemberIds: ['m7'],
        status: 'In Progress',
        progress: 70,
        dueDate: '2026-09-08',
        priority: 'Medium',
      },
      {
        id: 'a3',
        goalId: 'g10',
        title: 'Client Deliverable Presentations',
        description: 'Present work to stakeholders',
        assignedMemberIds: ['m7'],
        status: 'In Progress',
        progress: 65,
        dueDate: '2026-09-20',
        priority: 'Medium',
      }
    ]
  },
  {
    id: 'g11',
    departmentId: 'dept-artist',
    title: 'PRESENT DEVELOPMENT',
    description: 'Skill/tool development',
    progress: 50,
    actions: [
      {
        id: 'a4',
        goalId: 'g11',
        title: 'Tool Mastery Program',
        description: 'Internal tool proficiency development',
        assignedMemberIds: ['m7'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-11-15',
        priority: 'Medium',
      },
      {
        id: 'a5',
        goalId: 'g11',
        title: 'Pipeline Optimization',
        description: 'Improve creative production workflow',
        assignedMemberIds: ['m7'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-10-15',
        priority: 'Medium',
      },
      {
        id: 'a6',
        goalId: 'g11',
        title: 'Skill Enhancement Workshops',
        description: 'Internal skill sharing sessions',
        assignedMemberIds: ['m7'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-12-01',
        priority: 'Low',
      }
    ]
  },
  {
    id: 'g12',
    departmentId: 'dept-artist',
    title: 'FUTURE DEVELOPMENT',
    description: 'R&D for upcoming projects',
    progress: 25,
    actions: [
      {
        id: 'a7',
        goalId: 'g12',
        title: 'R&D Roadmap Planning',
        description: 'Strategic development planning',
        assignedMemberIds: ['m7'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-12-15',
        priority: 'High',
      },
      {
        id: 'a8',
        goalId: 'g12',
        title: 'Experimental Project Exploration',
        description: 'Research and prototyping',
        assignedMemberIds: ['m7'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2027-01-01',
        priority: 'High',
      },
      {
        id: 'a9',
        goalId: 'g12',
        title: 'Innovation Lab Development',
        description: 'Cross-team innovation initiatives',
        assignedMemberIds: ['m7'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2027-02-01',
        priority: 'Medium',
      }
    ]
  }
];

// Accounting Department
const accountingGoals: Goal[] = [
  {
    id: 'g13',
    departmentId: 'dept-accounting',
    title: 'Financial Reporting',
    description: 'Accurate financial statements generation',
    progress: 80,
    actions: [
      {
        id: 'a10',
        goalId: 'g13',
        title: 'Monthly Financial Close',
        description: 'Complete monthly accounting tasks',
        assignedMemberIds: ['m5'],
        status: 'In Progress',
        progress: 85,
        dueDate: '2026-09-05',
        priority: 'High',
      },
      {
        id: 'a11',
        goalId: 'g13',
        title: 'Quarterly Tax Filing',
        description: 'Prepare and file quarterly taxes',
        assignedMemberIds: ['m5'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-11-01',
        priority: 'High',
      },
      {
        id: 'a12',
        goalId: 'g13',
        title: 'Annual Audit Preparation',
        description: 'Audit readiness documentation',
        assignedMemberIds: ['m5'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2027-03-01',
        priority: 'High',
      }
    ]
  },
  {
    id: 'g14',
    departmentId: 'dept-accounting',
    title: 'Budget Management',
    description: 'Strategic financial planning',
    progress: 65,
    actions: [
      {
        id: 'a13',
        goalId: 'g14',
        title: 'Q3 Budget Forecast',
        description: 'Develop quarterly budget projections',
        assignedMemberIds: ['m5'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-10-01',
        priority: 'High',
      },
      {
        id: 'a14',
        goalId: 'g14',
        title: 'Expense Trend Analysis',
        description: 'Analyze spending patterns',
        assignedMemberIds: ['m5'],
        status: 'In Progress',
        progress: 60,
        dueDate: '2026-09-20',
        priority: 'Medium',
      },
      {
        id: 'a15',
        goalId: 'g14',
        title: 'Cash Flow Management',
        description: 'Monitor and optimize cash flow',
        assignedMemberIds: ['m5'],
        status: 'In Progress',
        progress: 65,
        dueDate: '2026-10-10',
        priority: 'High',
      }
    ]
  },
  {
    id: 'g15',
    departmentId: 'dept-accounting',
    title: 'Compliance Management',
    description: 'Regulatory financial stewardship',
    progress: 75,
    actions: [
      {
        id: 'a16',
        goalId: 'g15',
        title: 'Regulatory Reporting Update',
        description: 'Update compliance documentation',
        assignedMemberIds: ['m5'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-11-20',
        priority: 'High',
      },
      {
        id: 'a17',
        goalId: 'g15',
        title: 'Policy Review Cycle',
        description: 'Annual policy review implementation',
        assignedMemberIds: ['m5'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-12-15',
        priority: 'Medium',
      },
      {
        id: 'a18',
        goalId: 'g15',
        title: 'Audit Support Preparation',
        description: 'Prepare documentation for audits',
        assignedMemberIds: ['m5'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2027-01-15',
        priority: 'High',
      }
    ]
  }
];

// R&D Department
const rdGoals: Goal[] = [
  {
    id: 'g16',
    departmentId: 'dept-rd',
    title: 'Innovation Pipeline',
    description: 'Develop new product concepts',
    progress: 40,
    actions: [
      {
        id: 'a19',
        goalId: 'g16',
        title: 'Market Trend Analysis',
        description: 'Research industry trends and gaps',
        assignedMemberIds: ['m6'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-10-05',
        priority: 'High',
      },
      {
        id: 'a20',
        goalId: 'g16',
        title: 'Prototype Development Sprint',
        description: 'Create initial product prototypes',
        assignedMemberIds: ['m6'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-12-10',
        priority: 'High',
      },
      {
        id: 'a21',
        goalId: 'g16',
        title: 'Technical Feasibility Study',
        description: 'Assess technical viability',
        assignedMemberIds: ['m6'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-11-01',
        priority: 'Medium',
      }
    ]
  },
  {
    id: 'g17',
    departmentId: 'dept-rd',
    title: 'Technology Exploration',
    description: 'Investigate emerging technologies',
    progress: 30,
    actions: [
      {
        id: 'a22',
        goalId: 'g17',
        title: 'AI Capability Assessment',
        description: 'Evaluate AI tools for application',
        assignedMemberIds: ['m6'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-10-20',
        priority: 'Medium',
      },
      {
        id: 'a23',
        goalId: 'g17',
        title: 'Cloud Infrastructure Review',
        description: 'Analyze cloud service options',
        assignedMemberIds: ['m6'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-11-15',
        priority: 'Low',
      },
      {
        id: 'a24',
        goalId: 'g17',
        title: 'Innovation Workshops',
        description: 'Facilitate idea generation sessions',
        assignedMemberIds: ['m6'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-09-30',
        priority: 'Low',
      }
    ]
  },
  {
    id: 'g18',
    departmentId: 'dept-rd',
    title: 'Knowledge Transfer',
    description: 'Document and share expertise',
    progress: 50,
    actions: [
      {
        id: 'a25',
        goalId: 'g18',
        title: 'Internal Training Programs',
        description: 'Develop and deliver training sessions',
        assignedMemberIds: ['m6'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-11-30',
        priority: 'Medium',
      },
      {
        id: 'a26',
        goalId: 'g18',
        title: 'Documentation Standardization',
        description: 'Create knowledge base guidelines',
        assignedMemberIds: ['m6'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-12-01',
        priority: 'Medium',
      },
      {
        id: 'a27',
        goalId: 'g18',
        title: 'Mentorship Program',
        description: 'Pair senior and junior members',
        assignedMemberIds: ['m6'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2027-01-15',
        priority: 'Medium',
      }
    ]
  }
];

// Admin Department
const adminGoals: Goal[] = [
  {
    id: 'g19',
    departmentId: 'dept-admin',
    title: 'Policy Development',
    description: 'Create organizational policies',
    progress: 55,
    actions: [
      {
        id: 'a28',
        goalId: 'g19',
        title: 'Document Management System',
        description: 'Implement new document workflow',
        assignedMemberIds: ['m8'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-11-10',
        priority: 'Medium',
      },
      {
        id: 'a29',
        goalId: 'g19',
        title: 'Security Policy Update',
        description: 'Enhance data protection measures',
        assignedMemberIds: ['m8'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-12-10',
        priority: 'High',
      },
      {
        id: 'a30',
        goalId: 'g19',
        title: 'Compliance Framework',
        description: 'Establish regulatory compliance program',
        assignedMemberIds: ['m8'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2027-01-20',
        priority: 'High',
      }
    ]
  },
  {
    id: 'g20',
    departmentId: 'dept-admin',
    title: 'Team Administration',
    description: 'Support department operations',
    progress: 70,
    actions: [
      {
        id: 'a31',
        goalId: 'g20',
        title: 'Resource Planning',
        description: 'Optimize team staffing and allocation',
        assignedMemberIds: ['m8'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-10-15',
        priority: 'Medium',
      },
      {
        id: 'a32',
        goalId: 'g20',
        title: 'Process Improvement',
        description: 'Streamline administrative workflows',
        assignedMemberIds: ['m8'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-11-01',
        priority: 'Medium',
      },
      {
        id: 'a33',
        goalId: 'g20',
        title: 'Team Development',
        description: 'Implement staff growth initiatives',
        assignedMemberIds: ['m8'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2027-01-10',
        priority: 'Medium',
      }
    ]
  },
  {
    id: 'g21',
    departmentId: 'dept-admin',
    title: 'System Management',
    description: 'Maintain IT infrastructure',
    progress: 85,
    actions: [
      {
        id: 'a34',
        goalId: 'g21',
        title: 'Platform Maintenance',
        description: 'Schedule regular system updates',
        assignedMemberIds: ['m8'],
        status: 'In Progress',
        progress: 80,
        dueDate: '2026-09-25',
        priority: 'High',
      },
      {
        id: 'a35',
        goalId: 'g21',
        title: 'Security Protocol Testing',
        description: 'Conduct regular security assessments',
        assignedMemberIds: ['m8'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-11-25',
        priority: 'High',
      },
      {
        id: 'a36',
        goalId: 'g21',
        title: 'Service Level Monitoring',
        description: 'Track system performance metrics',
        assignedMemberIds: ['m8'],
        status: 'Not Started',
        progress: 0,
        dueDate: '2026-12-01',
        priority: 'Medium',
      }
    ]
  }
];

export const mockData = {
  departments: [
    ...marketingGoals.map(g => ({ ...g, departmentId: 'dept-marketing' })),
    ...salesGoals.map(g => ({ ...g, departmentId: 'dept-sales' })),
    ...operationsManagementGoals.map(g => ({ ...g, departmentId: 'dept-operations-management' })),
    ...operationsArtistGoals.map(g => ({ ...g, departmentId: 'dept-artist' })),
    ...accountingGoals.map(g => ({ ...g, departmentId: 'dept-accounting' })),
    ...rdGoals.map(g => ({ ...g, departmentId: 'dept-rd' })),
    ...adminGoals.map(g => ({ ...g, departmentId: 'dept-admin' }))
  ].filter(g => g.departmentId === 'dept-marketing' ||
               g.departmentId === 'dept-sales' ||
               g.departmentId === 'dept-operations-management' ||
               g.departmentId === 'dept-artist' ||
               g.departmentId === 'dept-accounting' ||
               g.departmentId === 'dept-rd' ||
               g.departmentId === 'dept-admin'),

  goals: [
    ...marketingGoals,
    ...salesGoals,
    ...operationsManagementGoals,
    ...operationsArtistGoals,
    ...accountingGoals,
    ...rdGoals,
    ...adminGoals
  ],

  actions: Array.flatMap(goal => goal.actions),

  members: members,

  departments: [
    {
      id: 'dept-marketing',
      name: 'Marketing',
      description: 'Client acquisition and brand growth',
      headId: 'm1',
      memberIds: ['m1', 'm2', 'm3'],
      progress: 45,
      isActive: true,
      goals: marketingGoals
    },
    {
      id: 'dept-sales',
      name: 'Sales',
      description: 'Revenue generation and client relationships',
      headId: 'm3',
      memberIds: ['m3'],
      progress: 33,
      isActive: true,
      goals: salesGoals
    },
    {
      id: 'dept-operations-management',
      name: 'Operations - Management',
      description: 'Core business process optimization',
      headId: 'm4',
      memberIds: ['m4'],
      progress: 57,
      isActive: true,
      goals: operationsManagementGoals
    },
    {
      id: 'dept-artist',
      name: 'Operations - Artist',
      description: 'Creative work delivery and development',
      headId: 'm7',
      memberIds: ['m7'],
      progress: 49,
      isActive: true,
      goals: operationsArtistGoals
    },
    {
      id: 'dept-accounting',
      name: 'Accounting',
      description: 'Financial stewardship and management',
      headId: 'm5',
      memberIds: ['m5'],
      progress: 76,
      isActive: true,
      goals: accountingGoals
    },
    {
      id: 'dept-rd',
      name: 'R&D',
      description: 'Innovation and technology exploration',
      headId: 'm6',
      memberIds: ['m6'],
      progress: 35,
      isActive: true,
      goals: rdGoals
    },
    {
      id: 'dept-admin',
      name: 'Admin',
      description: 'Organizational support and governance',
      headId: 'm8',
      memberIds: ['m8'],
      progress: 71,
      isActive: true,
      goals: adminGoals
    }
  ]
};