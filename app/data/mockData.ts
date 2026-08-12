// app/data/mockData.ts
import type { Department } from '@/types';

export const mockData = {
  departments: [
    {
      id: 'dept-marketing',
      name: 'Marketing',
      description: 'Client acquisition and brand growth',
      headId: 'm1',
      memberIds: ['m1', 'm2', 'm3'],
      progress: 45,
      isActive: true,
      goals: [
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
        }
      ]
    },
    // Add other departments here similarly
  ]
};

export const getDepartments = () => mockData.departments;