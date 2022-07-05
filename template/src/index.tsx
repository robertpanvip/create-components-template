import * as React from "react"

interface TestProps {
    description?: number
}

const Test: React.FC<TestProps> = (props) => {
    return (<div>React + vite + Ts</div>)
}
export default Test