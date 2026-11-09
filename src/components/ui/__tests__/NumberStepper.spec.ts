import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NumberStepper from '../NumberStepper.vue'

function mountStepper(modelValue: number) {
  return mount(NumberStepper, {
    props: {
      id: 'adults',
      label: 'Adults',
      min: 1,
      max: 3,
      addLabel: 'Add an adult',
      removeLabel: 'Remove an adult',
      valueText: `${modelValue} adults`,
      modelValue,
      'onUpdate:modelValue': () => {},
    },
  })
}

describe('NumberStepper', () => {
  it('steps up and down', async () => {
    const wrapper = mountStepper(2)
    await wrapper.get('#adults-add').trigger('click')
    await wrapper.get('#adults-remove').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[3], [1]])
  })

  it('stays put at the limits but keeps the button focusable', async () => {
    const wrapper = mountStepper(1)
    const remove = wrapper.get('#adults-remove')
    await remove.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(remove.attributes('aria-disabled')).toBe('true')
    expect(remove.attributes('disabled')).toBeUndefined()
  })

  it('names the buttons and announces the count in words', () => {
    const wrapper = mountStepper(2)
    expect(wrapper.get('#adults-add').attributes('aria-label')).toBe('Add an adult')
    expect(wrapper.get('[aria-live="polite"]').text()).toBe('2 adults')
  })
})
