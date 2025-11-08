import { relations } from "drizzle-orm/relations";
import { users, clients, tasks, taskAssignees, hourBlocks, clientMembers, projects, taskComments, timeLogs, timeLogTasks, taskAttachments, activityOverviewCache, activityLogs } from "./schema";

export const clientsRelations = relations(clients, ({one, many}) => ({
	user: one(users, {
		fields: [clients.createdBy],
		references: [users.id]
	}),
	hourBlocks: many(hourBlocks),
	clientMembers: many(clientMembers),
	projects: many(projects),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	clients: many(clients),
	taskAssignees: many(taskAssignees),
	hourBlocks: many(hourBlocks),
	clientMembers: many(clientMembers),
	projects: many(projects),
	taskComments: many(taskComments),
	timeLogs: many(timeLogs),
	taskAttachments: many(taskAttachments),
	activityOverviewCaches: many(activityOverviewCache),
	tasks_createdBy: many(tasks, {
		relationName: "tasks_createdBy_users_id"
	}),
	tasks_updatedBy: many(tasks, {
		relationName: "tasks_updatedBy_users_id"
	}),
	activityLogs: many(activityLogs),
}));

export const taskAssigneesRelations = relations(taskAssignees, ({one}) => ({
	task: one(tasks, {
		fields: [taskAssignees.taskId],
		references: [tasks.id]
	}),
	user: one(users, {
		fields: [taskAssignees.userId],
		references: [users.id]
	}),
}));

export const tasksRelations = relations(tasks, ({one, many}) => ({
	taskAssignees: many(taskAssignees),
	taskComments: many(taskComments),
	timeLogTasks: many(timeLogTasks),
	taskAttachments: many(taskAttachments),
	project: one(projects, {
		fields: [tasks.projectId],
		references: [projects.id]
	}),
	user_createdBy: one(users, {
		fields: [tasks.createdBy],
		references: [users.id],
		relationName: "tasks_createdBy_users_id"
	}),
	user_updatedBy: one(users, {
		fields: [tasks.updatedBy],
		references: [users.id],
		relationName: "tasks_updatedBy_users_id"
	}),
}));

export const hourBlocksRelations = relations(hourBlocks, ({one}) => ({
	user: one(users, {
		fields: [hourBlocks.createdBy],
		references: [users.id]
	}),
	client: one(clients, {
		fields: [hourBlocks.clientId],
		references: [clients.id]
	}),
}));

export const clientMembersRelations = relations(clientMembers, ({one}) => ({
	client: one(clients, {
		fields: [clientMembers.clientId],
		references: [clients.id]
	}),
	user: one(users, {
		fields: [clientMembers.userId],
		references: [users.id]
	}),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
	client: one(clients, {
		fields: [projects.clientId],
		references: [clients.id]
	}),
	user: one(users, {
		fields: [projects.createdBy],
		references: [users.id]
	}),
	timeLogs: many(timeLogs),
	tasks: many(tasks),
}));

export const taskCommentsRelations = relations(taskComments, ({one}) => ({
	task: one(tasks, {
		fields: [taskComments.taskId],
		references: [tasks.id]
	}),
	user: one(users, {
		fields: [taskComments.authorId],
		references: [users.id]
	}),
}));

export const timeLogsRelations = relations(timeLogs, ({one, many}) => ({
	project: one(projects, {
		fields: [timeLogs.projectId],
		references: [projects.id]
	}),
	user: one(users, {
		fields: [timeLogs.userId],
		references: [users.id]
	}),
	timeLogTasks: many(timeLogTasks),
}));

export const timeLogTasksRelations = relations(timeLogTasks, ({one}) => ({
	timeLog: one(timeLogs, {
		fields: [timeLogTasks.timeLogId],
		references: [timeLogs.id]
	}),
	task: one(tasks, {
		fields: [timeLogTasks.taskId],
		references: [tasks.id]
	}),
}));

export const taskAttachmentsRelations = relations(taskAttachments, ({one}) => ({
	task: one(tasks, {
		fields: [taskAttachments.taskId],
		references: [tasks.id]
	}),
	user: one(users, {
		fields: [taskAttachments.uploadedBy],
		references: [users.id]
	}),
}));

export const activityOverviewCacheRelations = relations(activityOverviewCache, ({one}) => ({
	user: one(users, {
		fields: [activityOverviewCache.userId],
		references: [users.id]
	}),
}));

export const activityLogsRelations = relations(activityLogs, ({one}) => ({
	user: one(users, {
		fields: [activityLogs.actorId],
		references: [users.id]
	}),
}));
