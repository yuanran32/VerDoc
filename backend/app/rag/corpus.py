import json
import os
from pathlib import Path

from app.rag.schemas import DocumentChunk

DEFAULT_FRAMEWORK = "vue"
DEFAULT_VERSION = "3.4"
SUPPORTED_VERSIONS = ("3.4", "3.3")
DEFAULT_CHUNKS_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "chunks" / "vue-3.4.jsonl"
)


VUE_34_CHUNKS: tuple[DocumentChunk, ...] = (
    DocumentChunk(
        id="vue@3.4:guide/essentials/watchers#watch-vs-watcheffect",
        text=(
            "watch 用来监听一个明确的数据源，例如 ref、getter 或响应式对象，"
            "只有被监听的数据源变化时才会触发回调。watchEffect 会立即运行一次回调，"
            "并自动追踪回调同步执行期间访问到的响应式依赖；依赖变化时再次运行。"
            "如果需要精确控制监听对象，优先使用 watch；如果依赖较多且希望自动收集，"
            "可以使用 watchEffect。"
        ),
        framework=DEFAULT_FRAMEWORK,
        version=DEFAULT_VERSION,
        source_path="src/guide/essentials/watchers.md",
        source_url="https://cn.vuejs.org/guide/essentials/watchers.html#watcheffect",
        heading_path=["指南", "基础", "侦听器", "watchEffect"],
    ),
    DocumentChunk(
        id="vue@3.4:api/sfc-script-setup#definemodel",
        text=(
            "`defineModel` 是 Vue 3.4 中用于在 `<script setup>` 声明组件 `v-model` 的宏。"
            "调用 `defineModel()` 会返回一个 `ref`，它的值会和父组件传入的 `v-model` 保持同步；"
            "在子组件中修改这个 `ref` 会触发对应的 `update` 事件。`defineModel` 也可以接收参数，"
            "用于声明具名 `v-model`。"
        ),
        framework=DEFAULT_FRAMEWORK,
        version=DEFAULT_VERSION,
        source_path="src/api/sfc-script-setup.md",
        source_url="https://cn.vuejs.org/api/sfc-script-setup.html#definemodel",
        heading_path=["API", "单文件组件", "script setup", "defineModel"],
        chunk_type="api-ref",
    ),
    DocumentChunk(
        id="vue@3.4:guide/components/v-model#basic-usage",
        text=(
            "组件上的 `v-model` 默认会使用 `modelValue` prop 和 `update:modelValue` 事件。"
            "在 Vue 3.4 之前，子组件通常需要 `defineProps` 声明 `modelValue`，"
            "再通过 `defineEmits` 声明 `update:modelValue`；Vue 3.4 起可以用 `defineModel` "
            "简化这段样板代码。"
        ),
        framework=DEFAULT_FRAMEWORK,
        version=DEFAULT_VERSION,
        source_path="src/guide/components/v-model.md",
        source_url="https://cn.vuejs.org/guide/components/v-model.html",
        heading_path=["指南", "组件", "组件 v-model", "基本用法"],
    ),
    DocumentChunk(
        id="vue@3.4:guide/essentials/computed#computed-caching",
        text=(
            "计算属性 computed 会基于响应式依赖进行缓存。只要依赖没有变化，"
            "多次访问同一个计算属性会直接返回之前的结果，而不会重复执行 getter。"
            "方法调用则每次渲染都会重新执行。适合把依赖响应式状态的派生数据写成 computed。"
        ),
        framework=DEFAULT_FRAMEWORK,
        version=DEFAULT_VERSION,
        source_path="src/guide/essentials/computed.md",
        source_url="https://cn.vuejs.org/guide/essentials/computed.html#computed-caching-vs-methods",
        heading_path=["指南", "基础", "计算属性", "计算属性缓存 vs 方法"],
    ),
    DocumentChunk(
        id="vue@3.4:guide/essentials/lifecycle#registering-hooks",
        text=(
            "组合式 API 通过 onMounted、onUpdated、onUnmounted 等函数注册生命周期钩子。"
            "这些钩子需要在组件 setup() 同步执行期间注册。onMounted 会在组件完成初始渲染并"
            "创建 DOM 节点后调用，常用于访问模板引用或执行依赖 DOM 的初始化逻辑。"
        ),
        framework=DEFAULT_FRAMEWORK,
        version=DEFAULT_VERSION,
        source_path="src/guide/essentials/lifecycle.md",
        source_url="https://cn.vuejs.org/guide/essentials/lifecycle.html#registering-lifecycle-hooks",
        heading_path=["指南", "基础", "生命周期", "注册周期钩子"],
    ),
    DocumentChunk(
        id="vue@3.4:guide/essentials/template-refs#accessing-the-refs",
        text=(
            "模板引用用于直接访问 DOM 元素或子组件实例。声明一个 ref 后，"
            "在模板中通过 ref 属性绑定同名引用；该引用要等组件挂载后才会有值，"
            "因此通常在 onMounted 或之后的时机读取。"
        ),
        framework=DEFAULT_FRAMEWORK,
        version=DEFAULT_VERSION,
        source_path="src/guide/essentials/template-refs.md",
        source_url="https://cn.vuejs.org/guide/essentials/template-refs.html#accessing-the-refs",
        heading_path=["指南", "基础", "模板引用", "访问模板引用"],
    ),
    DocumentChunk(
        id="vue@3.4:guide/essentials/forms#v-model",
        text=(
            "表单输入绑定可以使用 v-model 在表单元素和响应式状态之间建立双向绑定。"
            "v-model 会根据元素类型自动选择正确的 DOM property 和事件，例如文本输入、"
            "checkbox、radio 和 select 的处理方式不同。"
        ),
        framework=DEFAULT_FRAMEWORK,
        version=DEFAULT_VERSION,
        source_path="src/guide/essentials/forms.md",
        source_url="https://cn.vuejs.org/guide/essentials/forms.html",
        heading_path=["指南", "基础", "表单输入绑定"],
    ),
    DocumentChunk(
        id="vue@3.4:guide/reusability/composables#what-is-a-composable",
        text=(
            "组合式函数 composable 是利用 Vue 组合式 API 封装和复用有状态逻辑的函数。"
            "它通常以 use 开头，可以在组件 setup 中调用，并返回响应式状态或操作函数。"
            "组合式函数适合抽取可复用的数据获取、事件监听、状态同步等逻辑。"
        ),
        framework=DEFAULT_FRAMEWORK,
        version=DEFAULT_VERSION,
        source_path="src/guide/reusability/composables.md",
        source_url="https://cn.vuejs.org/guide/reusability/composables.html#what-is-a-composable",
        heading_path=["指南", "逻辑复用", "组合式函数"],
    ),
    DocumentChunk(
        id="vue@3.4:guide/components/props#props-declaration",
        text=(
            "组件通过 props 接收父组件传入的数据。在 <script setup> 中可以使用 defineProps "
            "声明 props；props 是只读的，子组件不应该直接修改。需要向父组件发送变化时，"
            "应使用 emit 事件或 v-model 约定。"
        ),
        framework=DEFAULT_FRAMEWORK,
        version=DEFAULT_VERSION,
        source_path="src/guide/components/props.md",
        source_url="https://cn.vuejs.org/guide/components/props.html#props-declaration",
        heading_path=["指南", "组件", "Props", "Props 声明"],
    ),
    DocumentChunk(
        id="vue@3.4:migration/filters#removed",
        text=(
            "Vue 3 移除了 filters。迁移时，原本用于文本格式化的 filters 通常应改写为"
            "方法调用或计算属性；如果多个组件需要复用同一段格式化逻辑，可以抽成普通函数"
            "或组合式函数。"
        ),
        framework=DEFAULT_FRAMEWORK,
        version=DEFAULT_VERSION,
        source_path="src/migration/filters.md",
        source_url="https://v3-migration.vuejs.org/breaking-changes/filters.html",
        heading_path=["迁移指南", "移除 Filters"],
    ),
)

VUE_33_CHUNKS: tuple[DocumentChunk, ...] = (
    DocumentChunk(
        id="vue@3.3:guide/essentials/watchers#watch-vs-watcheffect",
        text=(
            "watch 用来监听一个明确的数据源，例如 ref、getter 或响应式对象，"
            "只有被监听的数据源变化时才会触发回调。watchEffect 会立即运行一次回调，"
            "并自动追踪回调同步执行期间访问到的响应式依赖；依赖变化时再次运行。"
            "如果需要精确控制监听对象，优先使用 watch；如果依赖较多且希望自动收集，"
            "可以使用 watchEffect。"
        ),
        framework=DEFAULT_FRAMEWORK,
        version="3.3",
        source_path="src/guide/essentials/watchers.md",
        source_url="https://cn.vuejs.org/guide/essentials/watchers.html#watcheffect",
        heading_path=["指南", "基础", "侦听器", "watchEffect"],
    ),
    DocumentChunk(
        id="vue@3.3:guide/components/v-model#basic-usage",
        text=(
            "组件上的 `v-model` 默认会使用 `modelValue` prop 和 `update:modelValue` 事件。"
            "在 Vue 3.3 中，子组件通常需要 `defineProps` 声明 `modelValue`，"
            "再通过 `defineEmits` 声明 `update:modelValue`，然后由父组件使用 `v-model` 绑定。"
        ),
        framework=DEFAULT_FRAMEWORK,
        version="3.3",
        source_path="src/guide/components/v-model.md",
        source_url="https://cn.vuejs.org/guide/components/v-model.html",
        heading_path=["指南", "组件", "组件 v-model", "基本用法"],
    ),
    DocumentChunk(
        id="vue@3.3:guide/essentials/computed#computed-caching",
        text=(
            "计算属性 computed 会基于响应式依赖进行缓存。只要依赖没有变化，"
            "多次访问同一个计算属性会直接返回之前的结果，而不会重复执行 getter。"
            "方法调用则每次渲染都会重新执行。适合把依赖响应式状态的派生数据写成 computed。"
        ),
        framework=DEFAULT_FRAMEWORK,
        version="3.3",
        source_path="src/guide/essentials/computed.md",
        source_url="https://cn.vuejs.org/guide/essentials/computed.html#computed-caching-vs-methods",
        heading_path=["指南", "基础", "计算属性", "计算属性缓存 vs 方法"],
    ),
    DocumentChunk(
        id="vue@3.3:guide/essentials/lifecycle#registering-hooks",
        text=(
            "组合式 API 通过 onMounted、onUpdated、onUnmounted 等函数注册生命周期钩子。"
            "这些钩子需要在组件 setup() 同步执行期间注册。onMounted 会在组件完成初始渲染并"
            "创建 DOM 节点后调用，常用于访问模板引用或执行依赖 DOM 的初始化逻辑。"
        ),
        framework=DEFAULT_FRAMEWORK,
        version="3.3",
        source_path="src/guide/essentials/lifecycle.md",
        source_url="https://cn.vuejs.org/guide/essentials/lifecycle.html#registering-lifecycle-hooks",
        heading_path=["指南", "基础", "生命周期", "注册周期钩子"],
    ),
    DocumentChunk(
        id="vue@3.3:guide/essentials/forms#v-model",
        text=(
            "表单输入绑定可以使用 v-model 在表单元素和响应式状态之间建立双向绑定。"
            "v-model 会根据元素类型自动选择正确的 DOM property 和事件，例如文本输入、"
            "checkbox、radio 和 select 的处理方式不同。"
        ),
        framework=DEFAULT_FRAMEWORK,
        version="3.3",
        source_path="src/guide/essentials/forms.md",
        source_url="https://cn.vuejs.org/guide/essentials/forms.html",
        heading_path=["指南", "基础", "表单输入绑定"],
    ),
    DocumentChunk(
        id="vue@3.3:migration/filters#removed",
        text=(
            "Vue 3 移除了 filters。迁移时，原本用于文本格式化的 filters 通常应改写为"
            "方法调用或计算属性；如果多个组件需要复用同一段格式化逻辑，可以抽成普通函数"
            "或组合式函数。"
        ),
        framework=DEFAULT_FRAMEWORK,
        version="3.3",
        source_path="src/migration/filters.md",
        source_url="https://v3-migration.vuejs.org/breaking-changes/filters.html",
        heading_path=["迁移指南", "移除 Filters"],
    ),
)


def load_chunks(path: str | Path | None = None) -> list[DocumentChunk]:
    chunks_path = resolve_chunks_path(path)
    if chunks_path and chunks_path.exists():
        chunks = load_chunks_from_jsonl(chunks_path)
        if path is None and not any(chunk.version == "3.3" for chunk in chunks):
            chunks.extend(VUE_33_CHUNKS)
        return chunks

    return [*VUE_34_CHUNKS, *VUE_33_CHUNKS]


def resolve_chunks_path(path: str | Path | None = None) -> Path | None:
    if path is not None:
        return Path(path).expanduser().resolve()

    env_path = os.getenv("VERDOC_CHUNKS_PATH")
    if env_path:
        return Path(env_path).expanduser().resolve()

    return DEFAULT_CHUNKS_PATH


def load_chunks_from_jsonl(path: str | Path) -> list[DocumentChunk]:
    chunks_path = Path(path).expanduser().resolve()
    chunks: list[DocumentChunk] = []
    with chunks_path.open("r", encoding="utf-8") as file:
        for line in file:
            if line.strip():
                chunks.append(DocumentChunk.model_validate(json.loads(line)))
    return chunks
