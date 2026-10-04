import type { Messages } from '../messages'
import { admin } from './admin'
import { auth } from './auth'
import { core } from './core'
import { foods } from './foods'
import { plans } from './plans'
import { profile } from './profile'
import { progress } from './progress'
import { recipes } from './recipes'
import { shopping } from './shopping'
import { today } from './today'

export const ro = { ...core, today, progress, foods, recipes, plans, shopping, profile, auth, admin } satisfies Messages
