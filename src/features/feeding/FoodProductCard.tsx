import { Bone, Droplets, Package } from 'lucide-react'
import { Button, Notice } from '../../components/ui'
import { categories, formatGrams, stockForecast } from './model'
import type { FeedingEntry, FoodProduct } from './types'
export function FoodProductCard({product,entries,timezone,onEdit}:{product:FoodProduct;entries:FeedingEntry[];timezone:string;onEdit:()=>void}) {
 const forecast=stockForecast(product,entries)
 const Icon=product.category==='wet'?Droplets:product.category==='treat'?Bone:Package
 return <section className={`card food-product-card food-product-${product.category}`}>
  <div className="food-product-heading"><span className="food-product-icon"><Icon size={20} aria-hidden="true"/></span><div><p className="eyebrow">{categories[product.category]}</p><h3>{product.name}</h3></div></div>
  <div className="food-product-balance"><p className="feeding-stock">{formatGrams(forecast.remaining)}<span>in the cupboard</span></p>{forecast.days!==null&&<span className={`food-days${forecast.low?' food-days-low':''}`}>{Number(forecast.days.toFixed(1))} days left</span>}</div>
  <p className="food-product-portions">{formatGrams(Number(product.portion_grams))} usual portion<span aria-hidden="true"> · </span>{Number(product.daily_grams)>0?`${formatGrams(Number(product.daily_grams))}/day`:'Irregular daily use'}</p>
  {forecast.low&&<Notice>{forecast.remaining===0?'Out of food. Add a purchase to restock.':'Time to buy more food.'}</Notice>}
  {forecast.buyBy&&<p className="photo-hint">Estimated buy-by: {forecast.buyBy.toLocaleDateString(undefined,{timeZone:timezone})}</p>}
  <Button type="button" className="secondary" onClick={onEdit}>Edit product / stock</Button>
 </section>
}
