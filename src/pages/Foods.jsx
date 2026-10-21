// Foods tab: the saved-food library as a full screen.

import PageHeader from '../components/PageHeader.jsx'
import Icon from '../components/Icon.jsx'
import { FoodLibraryList } from '../components/FoodLibrary.jsx'

export default function Foods({ date, meal, onNewFood }) {
  return (
    <div>
      <PageHeader
        title="My Foods"
        subtitle="Library"
        right={
          <button onClick={onNewFood} className="btn-secondary shrink-0 py-2 text-sm">
            <Icon name="plus" size={16} strokeWidth={2.5} /> New food
          </button>
        }
      />
      <FoodLibraryList date={date} defaultMeal={meal} onNewFood={onNewFood} />
    </div>
  )
}
